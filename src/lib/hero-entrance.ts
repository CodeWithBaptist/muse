import type { CSSProperties } from 'react';

/**
 * Hero entrance choreography.
 *
 * The hero runs its entrance in CSS rather than through Motion so the text
 * paints as soon as the stylesheet is parsed, without waiting for hydration.
 * The primary hero text starts within about 0.25s and the whole hero settles
 * within about 1.1s. Only transform and opacity are animated.
 *
 * The canvas is the one exception: it repaints per frame, and the ridge is the
 * last beat to settle because it keeps drifting with the beat after the text
 * has landed.
 */

export type HeroBeatId = 'ridge' | 'wordmark' | 'heading' | 'actions';

export interface HeroBeat {
  id: HeroBeatId;
  /** Seconds from first paint. */
  start: number;
  /** Seconds. */
  duration: number;
}

export const HERO_RIDGE_DISTANCE_PX = 16;
export const HERO_TEXT_DISTANCE_PX = 12;

export const HERO_CHOREOGRAPHY: readonly HeroBeat[] = [
  { id: 'wordmark', start: 0.05, duration: 0.7 },
  { id: 'ridge', start: 0.1, duration: 1 },
  { id: 'heading', start: 0.12, duration: 0.4 },
  { id: 'actions', start: 0.24, duration: 0.4 },
];

const HERO_BEATS: Record<HeroBeatId, HeroBeat> = HERO_CHOREOGRAPHY.reduce(
  (beats, beat) => ({ ...beats, [beat.id]: beat }),
  {} as Record<HeroBeatId, HeroBeat>,
);

export function heroBeat(id: HeroBeatId): HeroBeat {
  return HERO_BEATS[id];
}

/** Inline delay and duration for the shared `.muse-hero-enter` classes. */
export function heroBeatStyle(id: HeroBeatId): CSSProperties {
  const beat = heroBeat(id);
  return {
    animationDelay: `${Math.round(beat.start * 1000)}ms`,
    animationDuration: `${Math.round(beat.duration * 1000)}ms`,
  };
}

/** When the last beat finishes, in milliseconds. */
export function heroEntranceSettleMs(): number {
  return Math.round(
    Math.max(...HERO_CHOREOGRAPHY.map((beat) => beat.start + beat.duration)) * 1000,
  );
}
