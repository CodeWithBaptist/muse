import type { CSSProperties } from 'react';

/**
 * Timeline for the scripted landing preview.
 *
 * This is the only scripted simulation in the product: a prompt, a thinking
 * beat, a reply, the example rows, and the example control. It never runs
 * against a real account and the preview says so on screen. Everything is CSS
 * driven from these numbers so the same frame renders without JavaScript.
 */

export type PreviewBeatId = 'prompt' | 'thinking' | 'reply' | 'action';

export interface PreviewBeat {
  id: PreviewBeatId;
  startMs: number;
  durationMs: number;
}

export const PREVIEW_TRACKS_START_MS = 2900;
export const PREVIEW_TRACK_STAGGER_MS = 60;
export const PREVIEW_TRACK_STAGGER_STEPS = 8;
export const PREVIEW_TRACK_DURATION_MS = 320;

export const PREVIEW_BEATS: readonly PreviewBeat[] = [
  { id: 'prompt', startMs: 0, durationMs: 320 },
  // The thinking beat appears, holds, then fades out while the reply arrives.
  { id: 'thinking', startMs: 620, durationMs: 1900 },
  { id: 'reply', startMs: 2450, durationMs: 360 },
  { id: 'action', startMs: 3760, durationMs: 320 },
];

const PREVIEW_BEAT_MAP: Record<PreviewBeatId, PreviewBeat> = PREVIEW_BEATS.reduce(
  (beats, beat) => ({ ...beats, [beat.id]: beat }),
  {} as Record<PreviewBeatId, PreviewBeat>,
);

export function previewBeat(id: PreviewBeatId): PreviewBeat {
  return PREVIEW_BEAT_MAP[id];
}

export function previewItemDelayMs(id: PreviewBeatId): number {
  return previewBeat(id).startMs;
}

/** Cap the stagger so a longer list still lands together, like the track rows. */
export function previewTrackDelayMs(index: number): number {
  const step = Math.min(Math.max(index, 0), PREVIEW_TRACK_STAGGER_STEPS - 1);
  return PREVIEW_TRACKS_START_MS + step * PREVIEW_TRACK_STAGGER_MS;
}

export function previewBeatStyle(id: PreviewBeatId): CSSProperties {
  const beat = previewBeat(id);
  return {
    animationDelay: `${beat.startMs}ms`,
    animationDuration: `${beat.durationMs}ms`,
  };
}

export function previewTrackStyle(index: number): CSSProperties {
  return {
    animationDelay: `${previewTrackDelayMs(index)}ms`,
    animationDuration: `${PREVIEW_TRACK_DURATION_MS}ms`,
  };
}

/** When the scripted sequence is finished, in milliseconds. */
export function previewTotalMs(): number {
  const lastBeat = Math.max(
    ...PREVIEW_BEATS.map((beat) => beat.startMs + beat.durationMs),
    previewTrackDelayMs(PREVIEW_TRACK_STAGGER_STEPS) + PREVIEW_TRACK_DURATION_MS,
  );
  return lastBeat;
}
