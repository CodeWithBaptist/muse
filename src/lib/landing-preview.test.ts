import { describe, expect, it } from 'vitest';
import {
  LANDING_SAMPLE,
  SAMPLE_PROMPT,
  SAMPLE_REPLY,
  SAMPLE_SPOTIFY_URL,
  SAMPLE_THINKING_LINES,
  SAMPLE_TRACKS,
} from './landing-sample';
import {
  IDLE_PREVIEW_STATE,
  PREVIEW_PROMPT_CHAR_MS,
  PREVIEW_REPLY_WORD_MS,
  PREVIEW_THINKING_LINE_MS,
  PREVIEW_VISIBLE_THRESHOLD,
  previewCreateState,
  previewFinalState,
  previewReplayState,
  previewStartState,
  previewStateAt,
  previewTimeline,
  replyWordCount,
} from './landing-preview';

const timeline = previewTimeline(LANDING_SAMPLE);

describe('landing sample data', () => {
  it('is a small, clearly labelled sample set', () => {
    expect(SAMPLE_PROMPT.length).toBeGreaterThan(0);
    expect(SAMPLE_REPLY.split(/\s+/).length).toBeGreaterThan(4);
    expect(SAMPLE_THINKING_LINES).toHaveLength(2);
    expect(SAMPLE_TRACKS).toHaveLength(3);
    // Sample ids are not Spotify ids, so the real TrackRow renders no links.
    for (const track of SAMPLE_TRACKS) {
      expect(track.id).toMatch(/^sample-/);
      // Durations are never invented. The sample carries none at all, because
      // only Spotify can state an authoritative duration_ms and it is not
      // contacted by the demo.
      expect('durationMs' in track).toBe(false);
    }
    // A request for something like one artist must not be answered with three
    // tracks by that same artist.
    expect(new Set(SAMPLE_TRACKS.map((track) => track.artist)).size).toBeGreaterThan(1);
    expect(PREVIEW_VISIBLE_THRESHOLD).toBe(0.4);
  });
});

describe('preview timeline', () => {
  it('runs the phases strictly in order', () => {
    expect(timeline.typingEnd).toBe(SAMPLE_PROMPT.length * PREVIEW_PROMPT_CHAR_MS);
    expect(timeline.thinkingEnd).toBe(
      timeline.typingEnd + SAMPLE_THINKING_LINES.length * PREVIEW_THINKING_LINE_MS,
    );
    expect(timeline.replyEnd).toBeGreaterThan(timeline.thinkingEnd);
    expect(timeline.rowsEnd).toBeGreaterThan(timeline.replyEnd);
    expect(timeline.creatingEnd).toBeGreaterThan(timeline.rowsEnd);
    expect(timeline.createdEnd).toBeGreaterThan(timeline.creatingEnd);
    expect(timeline.totalMs).toBe(timeline.createdEnd);
    // The whole demo stays a one-off sequence of about seven seconds.
    expect(timeline.totalMs).toBeGreaterThan(5000);
    expect(timeline.totalMs).toBeLessThan(10_000);
  });

  it('counts the reply words the way the reveal does', () => {
    expect(replyWordCount(SAMPLE_REPLY)).toBe(SAMPLE_REPLY.split(/\s+/).length);
    expect(replyWordCount('  ')).toBe(0);
  });
});

describe('preview state machine', () => {
  it('starts idle, with nothing on screen', () => {
    expect(IDLE_PREVIEW_STATE.phase).toBe('idle');
    expect(IDLE_PREVIEW_STATE.done).toBe(false);
    expect(IDLE_PREVIEW_STATE.visibleTracks).toBe(0);
    expect(previewReplayState()).toEqual(IDLE_PREVIEW_STATE);
    expect(previewReplayState()).not.toBe(IDLE_PREVIEW_STATE);
  });

  it('types the prompt one character at a time', () => {
    const start = previewStateAt(LANDING_SAMPLE, 0);
    expect(start.phase).toBe('typing');
    expect(start.typedPrompt).toBe('');

    const middle = previewStateAt(LANDING_SAMPLE, PREVIEW_PROMPT_CHAR_MS * 10);
    expect(middle.phase).toBe('typing');
    expect(middle.typedPrompt).toBe(SAMPLE_PROMPT.slice(0, 10));
    expect(middle.replyWords).toBe(0);

    const almost = previewStateAt(LANDING_SAMPLE, timeline.typingEnd - 1);
    expect(almost.phase).toBe('typing');
    expect(almost.typedPrompt.length).toBe(SAMPLE_PROMPT.length - 1);
  });

  it('thinks through both lines before replying', () => {
    const first = previewStateAt(LANDING_SAMPLE, timeline.typingEnd);
    expect(first.phase).toBe('thinking');
    expect(first.typedPrompt).toBe(SAMPLE_PROMPT);
    expect(SAMPLE_THINKING_LINES[first.thinkingLineIndex]).toBe(
      'Understanding your vibe',
    );
    expect(first.replyWords).toBe(0);

    const second = previewStateAt(
      LANDING_SAMPLE,
      timeline.typingEnd + PREVIEW_THINKING_LINE_MS,
    );
    expect(second.phase).toBe('thinking');
    expect(SAMPLE_THINKING_LINES[second.thinkingLineIndex]).toBe(
      'Finding something that fits',
    );

    const last = previewStateAt(LANDING_SAMPLE, timeline.thinkingEnd - 1);
    expect(last.thinkingLineIndex).toBe(SAMPLE_THINKING_LINES.length - 1);
  });

  it('reveals the reply word by word with no cursor', () => {
    const first = previewStateAt(LANDING_SAMPLE, timeline.thinkingEnd);
    expect(first.phase).toBe('replying');
    expect(first.thinkingLineIndex).toBe(-1);
    expect(first.replyWords).toBe(0);

    const some = previewStateAt(
      LANDING_SAMPLE,
      timeline.thinkingEnd + PREVIEW_REPLY_WORD_MS * 3,
    );
    expect(some.phase).toBe('replying');
    expect(some.replyWords).toBe(3);

    const all = previewStateAt(LANDING_SAMPLE, timeline.replyEnd);
    expect(all.replyWords).toBe(replyWordCount(SAMPLE_REPLY));
    expect(all.visibleTracks).toBe(0);
    expect(all.typedPrompt).toBe(SAMPLE_PROMPT);
  });

  it('rises the rows in one at a time', () => {
    const noneYet = previewStateAt(LANDING_SAMPLE, timeline.replyEnd + 1);
    expect(noneYet.phase).toBe('replying');
    expect(noneYet.visibleTracks).toBe(0);

    const firstRow = previewStateAt(LANDING_SAMPLE, timeline.replyEnd + 220);
    expect(firstRow.phase).toBe('rows');
    expect(firstRow.visibleTracks).toBe(1);

    const allRows = previewStateAt(LANDING_SAMPLE, timeline.rowsEnd);
    expect(allRows.visibleTracks).toBe(SAMPLE_TRACKS.length);
    expect(allRows.createStatus).toBe('idle');
  });

  it('creates, confirms, then opens', () => {
    const creating = previewStateAt(LANDING_SAMPLE, timeline.creatingEnd - 1);
    expect(creating.phase).toBe('creating');
    expect(creating.createStatus).toBe('loading');

    const created = previewStateAt(LANDING_SAMPLE, timeline.creatingEnd);
    expect(created.phase).toBe('created');
    expect(created.createStatus).toBe('success');
    expect(created.done).toBe(false);

    const open = previewStateAt(LANDING_SAMPLE, timeline.totalMs);
    expect(open.phase).toBe('open');
    expect(open.createStatus).toBe('open');
    expect(open.done).toBe(true);
    expect(open.replyWords).toBe(replyWordCount(SAMPLE_REPLY));
    expect(open.visibleTracks).toBe(SAMPLE_TRACKS.length);
  });

  it('holds the finished frame and never loops on its own', () => {
    const final = previewFinalState(LANDING_SAMPLE);
    expect(final).toEqual(previewStateAt(LANDING_SAMPLE, timeline.totalMs));
    expect(previewStateAt(LANDING_SAMPLE, timeline.totalMs + 60_000)).toEqual(
      final,
    );
    expect(previewStateAt(LANDING_SAMPLE, timeline.totalMs + 60_000)).not.toEqual(
      IDLE_PREVIEW_STATE,
    );
  });

  it('never goes backwards in time', () => {
    let previousTime = 0;
    let previousTyped = 0;
    let previousReplyWords = 0;
    let previousTracks = 0;
    for (let time = 0; time <= timeline.totalMs; time += 25) {
      const state = previewStateAt(LANDING_SAMPLE, time);
      expect(state.typedPrompt.length).toBeGreaterThanOrEqual(previousTyped);
      expect(state.replyWords).toBeGreaterThanOrEqual(previousReplyWords);
      expect(state.visibleTracks).toBeGreaterThanOrEqual(previousTracks);
      previousTyped = state.typedPrompt.length;
      previousReplyWords = state.replyWords;
      previousTracks = state.visibleTracks;
      previousTime = time;
    }
    expect(previousTime).toBeGreaterThan(0);
    expect(previousTyped).toBe(SAMPLE_PROMPT.length);
  });

  it('shows the finished frame with no animation when motion is reduced', () => {
    const reduced = previewStartState(LANDING_SAMPLE, true);
    expect(reduced).toEqual(previewFinalState(LANDING_SAMPLE));
    expect(reduced.done).toBe(true);
    expect(reduced.createStatus).toBe('open');
    expect(reduced.replyWords).toBe(replyWordCount(SAMPLE_REPLY));

    // Without reduced motion the same call starts the sequence instead.
    const normal = previewStartState(LANDING_SAMPLE, false);
    expect(normal.phase).toBe('typing');
    expect(normal.typedPrompt).toBe('');
    expect(normal.done).toBe(false);
  });

  it('maps the create control to a controlled state', () => {
    const idle = previewCreateState(LANDING_SAMPLE, IDLE_PREVIEW_STATE);
    expect(idle.status).toBe('idle');
    expect(idle.spotifyUrl).toBeNull();

    const loading = previewCreateState(LANDING_SAMPLE, {
      ...IDLE_PREVIEW_STATE,
      createStatus: 'loading',
    });
    expect(loading.status).toBe('loading');
    expect(loading.requestedCount).toBe(SAMPLE_TRACKS.length);

    const open = previewCreateState(LANDING_SAMPLE, {
      ...IDLE_PREVIEW_STATE,
      createStatus: 'open',
    });
    expect(open.status).toBe('open');
    expect(open.spotifyUrl).toBe(SAMPLE_SPOTIFY_URL);
    expect(open.addedCount).toBe(SAMPLE_TRACKS.length);
    expect(open.failedTrackUris).toEqual([]);
    expect(open.error).toBeNull();
  });
});
