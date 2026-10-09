/**
 * The landing demo state machine.
 *
 * The preview plays one scripted conversation once, when it is at least 40
 * percent visible: a prompt types in, MUSE thinks through two lines, the reply
 * reveals word by word, the example rows rise in, and the list actions walk
 * through copying, copied, and the open-in links. Nothing here contacts any
 * service and no list leaves the page: the on screen label says Sample.
 *
 * Everything is derived from one elapsed time, so the machine is a pure
 * function: `previewStateAt(sample, elapsedMs)`. The component replays it, and
 * the tests step through the same numbers.
 */

import type { LandingSample } from '@/lib/landing-sample';

export const PREVIEW_PROMPT_CHAR_MS = 42;
export const PREVIEW_THINKING_LINE_MS = 1000;
export const PREVIEW_REPLY_WORD_MS = 55;
export const PREVIEW_ROW_STAGGER_MS = 50;
export const PREVIEW_ROWS_DELAY_MS = 220;
export const PREVIEW_COPY_MS = 900;
export const PREVIEW_ACTION_DELAY_MS = 200;
/** How long "Copied" holds before the open-in links appear. */
export const PREVIEW_COPIED_MS = 1200;
/** Pause between the open control and the first row starting to play. */
export const PREVIEW_PLAY_DELAY_MS = 500;
/** How much of the preview has to be visible before it starts. */
export const PREVIEW_VISIBLE_THRESHOLD = 0.4;

export type PreviewPhase =
  | 'idle'
  | 'typing'
  | 'thinking'
  | 'replying'
  | 'rows'
  | 'copying'
  | 'copied'
  | 'open'
  | 'playing';

/** idle: Copy list offered; loading: copying; success: copied; open: open-in links shown. */
export type PreviewActionStatus = 'idle' | 'loading' | 'success' | 'open';

export interface PreviewState {
  phase: PreviewPhase;
  /** The part of the prompt that has typed in so far. */
  typedPrompt: string;
  /** True once the prompt has left the input and joined the thread. */
  promptInThread: boolean;
  /** True once the first row shows the playing state. */
  playing: boolean;
  /** Index into the sample thinking lines, or -1 when the row is hidden. */
  thinkingLineIndex: number;
  /** How many words of the reply are visible. */
  replyWords: number;
  /** How many example rows have risen in. */
  visibleTracks: number;
  actionStatus: PreviewActionStatus;
  /** True when the sequence has reached its last state. */
  done: boolean;
}

export interface PreviewTimeline {
  /** Start of each phase, in milliseconds from the first frame. */
  typingEnd: number;
  thinkingEnd: number;
  replyEnd: number;
  rowsEnd: number;
  copyingEnd: number;
  copiedEnd: number;
  playingAt: number;
  totalMs: number;
}

export function replyWordCount(reply: string): number {
  return reply.split(/\s+/).filter((word) => word.length > 0).length;
}

/** Phase boundaries for a sample. Every phase runs after the one before it. */
export function previewTimeline(sample: LandingSample): PreviewTimeline {
  const typingEnd = sample.prompt.length * PREVIEW_PROMPT_CHAR_MS;
  const thinkingEnd =
    typingEnd + sample.thinkingLines.length * PREVIEW_THINKING_LINE_MS;
  const replyEnd =
    thinkingEnd + replyWordCount(sample.reply) * PREVIEW_REPLY_WORD_MS;
  const rowsEnd =
    replyEnd +
    PREVIEW_ROWS_DELAY_MS +
    sample.tracks.length * PREVIEW_ROW_STAGGER_MS;
  const copyingEnd = rowsEnd + PREVIEW_ACTION_DELAY_MS + PREVIEW_COPY_MS;
  const copiedEnd = copyingEnd + PREVIEW_COPIED_MS;
  const playingAt = copiedEnd + PREVIEW_PLAY_DELAY_MS;

  return {
    typingEnd,
    thinkingEnd,
    replyEnd,
    rowsEnd,
    copyingEnd,
    copiedEnd,
    playingAt,
    totalMs: playingAt,
  };
}

function clampCount(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.floor(value)));
}

export const IDLE_PREVIEW_STATE: PreviewState = {
  phase: 'idle',
  typedPrompt: '',
  promptInThread: false,
  playing: false,
  thinkingLineIndex: -1,
  replyWords: 0,
  visibleTracks: 0,
  actionStatus: 'idle',
  done: false,
};

/** Every phase from thinking onward shows the prompt in the thread. */
const PHASES_WITH_PROMPT: readonly PreviewPhase[] = [
  'thinking',
  'replying',
  'rows',
  'copying',
  'copied',
  'open',
  'playing',
];

/** The state for one elapsed time. Elapsed 0 is the first frame of typing. */
export function previewStateAt(
  sample: LandingSample,
  elapsedMs: number,
): PreviewState {
  const time = Math.max(0, elapsedMs);
  const timeline = previewTimeline(sample);
  const wordCount = replyWordCount(sample.reply);
  const trackCount = sample.tracks.length;

  const base: PreviewState = {
    ...IDLE_PREVIEW_STATE,
    typedPrompt: sample.prompt.slice(
      0,
      clampCount(time / PREVIEW_PROMPT_CHAR_MS, sample.prompt.length),
    ),
  };

  /** Everything after the typing phase shares the same completed thread. */
  const settled = (phase: PreviewPhase): PreviewState => ({
    ...base,
    typedPrompt: sample.prompt,
    promptInThread: true,
    phase,
    replyWords: wordCount,
    visibleTracks: trackCount,
  });

  if (time >= timeline.playingAt) {
    return {
      ...settled('playing'),
      actionStatus: 'open',
      playing: true,
      done: true,
    };
  }

  if (time >= timeline.copiedEnd) {
    return { ...settled('open'), actionStatus: 'open' };
  }

  if (time >= timeline.copyingEnd) {
    return { ...settled('copied'), actionStatus: 'success' };
  }

  if (time >= timeline.rowsEnd + PREVIEW_ACTION_DELAY_MS) {
    return { ...settled('copying'), actionStatus: 'loading' };
  }

  if (time >= timeline.rowsEnd) {
    return settled('rows');
  }

  if (time >= timeline.replyEnd + PREVIEW_ROWS_DELAY_MS) {
    return {
      ...settled('rows'),
      replyWords: wordCount,
      visibleTracks: clampCount(
        1 +
          (time - timeline.replyEnd - PREVIEW_ROWS_DELAY_MS) /
            PREVIEW_ROW_STAGGER_MS,
        trackCount,
      ),
    };
  }

  if (time >= timeline.thinkingEnd) {
    return {
      ...base,
      typedPrompt: sample.prompt,
      promptInThread: true,
      phase: 'replying',
      replyWords: clampCount(
        (time - timeline.thinkingEnd) / PREVIEW_REPLY_WORD_MS,
        wordCount,
      ),
    };
  }

  if (time >= timeline.typingEnd) {
    return {
      ...base,
      typedPrompt: sample.prompt,
      promptInThread: true,
      phase: 'thinking',
      thinkingLineIndex: clampCount(
        (time - timeline.typingEnd) / PREVIEW_THINKING_LINE_MS,
        sample.thinkingLines.length - 1,
      ),
    };
  }

  return { ...base, phase: 'typing' };
}

/** The finished frame: what the server renders, and what reduced motion shows. */
export function previewFinalState(sample: LandingSample): PreviewState {
  return previewStateAt(sample, previewTimeline(sample).totalMs);
}

/**
 * The frame to start from. Reduced motion skips the sequence entirely and shows
 * the finished frame with no animation.
 */
export function previewStartState(
  sample: LandingSample,
  reduceMotion: boolean,
): PreviewState {
  return reduceMotion ? previewFinalState(sample) : previewStateAt(sample, 0);
}

export function previewReplayState(): PreviewState {
  return { ...IDLE_PREVIEW_STATE };
}

/** True while the phase shows the prompt as a message in the thread. */
export function promptIsInThread(phase: PreviewPhase): boolean {
  return PHASES_WITH_PROMPT.includes(phase);
}
