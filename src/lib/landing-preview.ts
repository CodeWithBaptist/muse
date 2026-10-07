/**
 * The landing demo state machine.
 *
 * The preview plays one scripted conversation once, when it is at least 40
 * percent visible: a prompt types in, MUSE thinks through two lines, the reply
 * reveals word by word, the example rows rise in, and the real Create in
 * Spotify control moves through creating, created, and open. Nothing here
 * contacts Spotify and no playlist exists: the on screen label says Sample.
 *
 * Everything is derived from one elapsed time, so the machine is a pure
 * function: `previewStateAt(sample, elapsedMs)`. The component replays it, and
 * the tests step through the same numbers.
 */

import { SUCCESS_HOLD_MS, type CreateInSpotifyState } from '@/lib/playlist-export';
import type { LandingSample } from '@/lib/landing-sample';

export const PREVIEW_PROMPT_CHAR_MS = 42;
export const PREVIEW_THINKING_LINE_MS = 1000;
export const PREVIEW_REPLY_WORD_MS = 55;
export const PREVIEW_ROW_STAGGER_MS = 50;
export const PREVIEW_ROWS_DELAY_MS = 220;
export const PREVIEW_CREATE_MS = 900;
export const PREVIEW_ACTION_DELAY_MS = 200;
export const PREVIEW_CREATED_MS = SUCCESS_HOLD_MS;
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
  | 'creating'
  | 'created'
  | 'open'
  | 'playing';

export type PreviewCreateStatus = 'idle' | 'loading' | 'success' | 'open';

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
  createStatus: PreviewCreateStatus;
  /** True when the sequence has reached its last state. */
  done: boolean;
}

export interface PreviewTimeline {
  /** Start of each phase, in milliseconds from the first frame. */
  typingEnd: number;
  thinkingEnd: number;
  replyEnd: number;
  rowsEnd: number;
  creatingEnd: number;
  createdEnd: number;
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
  const replyEnd = thinkingEnd + replyWordCount(sample.reply) * PREVIEW_REPLY_WORD_MS;
  const rowsEnd =
    replyEnd + PREVIEW_ROWS_DELAY_MS + sample.tracks.length * PREVIEW_ROW_STAGGER_MS;
  const creatingEnd = rowsEnd + PREVIEW_ACTION_DELAY_MS + PREVIEW_CREATE_MS;
  const createdEnd = creatingEnd + PREVIEW_CREATED_MS;
  const playingAt = createdEnd + PREVIEW_PLAY_DELAY_MS;

  return {
    typingEnd,
    thinkingEnd,
    replyEnd,
    rowsEnd,
    creatingEnd,
    createdEnd,
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
  createStatus: 'idle',
  done: false,
};

/** Every phase from thinking onward shows the prompt in the thread. */
const PHASES_WITH_PROMPT: readonly PreviewPhase[] = [
  'thinking',
  'replying',
  'rows',
  'creating',
  'created',
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
      createStatus: 'open',
      playing: true,
      done: true,
    };
  }

  if (time >= timeline.createdEnd) {
    return { ...settled('open'), createStatus: 'open' };
  }

  if (time >= timeline.creatingEnd) {
    return { ...settled('created'), createStatus: 'success' };
  }

  if (time >= timeline.rowsEnd + PREVIEW_ACTION_DELAY_MS) {
    return { ...settled('creating'), createStatus: 'loading' };
  }

  if (time >= timeline.rowsEnd) {
    return settled('rows');
  }

  if (time >= timeline.replyEnd + PREVIEW_ROWS_DELAY_MS) {
    return {
      ...settled('rows'),
      replyWords: wordCount,
      visibleTracks: clampCount(
        1 + (time - timeline.replyEnd - PREVIEW_ROWS_DELAY_MS) / PREVIEW_ROW_STAGGER_MS,
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

/**
 * The controlled state handed to the real Create in Spotify control. The
 * control is inert in the demo, so the URL is only ever rendered as text on a
 * span, never as a link.
 */
export function previewCreateState(
  sample: LandingSample,
  state: PreviewState,
): CreateInSpotifyState {
  const requestedCount = sample.tracks.length;
  const created: CreateInSpotifyState = {
    status: 'success',
    spotifyUrl: sample.spotifyUrl,
    spotifyPlaylistId: null,
    requestedCount,
    addedCount: requestedCount,
    failedTrackUris: [],
    error: null,
    retryingFailedOnly: false,
  };

  switch (state.createStatus) {
    case 'loading':
      return { ...created, status: 'loading' };
    case 'success':
      return created;
    case 'open':
      return { ...created, status: 'open' };
    case 'idle':
    default:
      return {
        ...created,
        status: 'idle',
        spotifyUrl: null,
        requestedCount: 0,
        addedCount: 0,
      };
  }
}
