/**
 * The vertical rail.
 *
 * Four steps sit beside one thin rail. The step crossing the middle band of the
 * viewport becomes active: it reads at full strength and its number uses the
 * accent color, while the others dim. The rail fills to the active step with a transform, so
 * nothing in this section changes layout.
 *
 * The activation rules are here as plain functions so they can be unit tested
 * without an observer.
 */

/** The band around the middle of the viewport that marks the active step. */
export const STEP_BAND_ROOT_MARGIN = '-42% 0px -42% 0px';
/** Opacity of the steps that are not active. */
export const STEP_DIM_OPACITY = 0.4;
/** How long the rail fill takes to grow. */
export const STEP_RAIL_TRANSITION_MS = 600;

/**
 * The active step, from the indices currently crossing the middle band. The
 * first of them wins, so scrolling up and down agree on the same step, and -1
 * means nothing is in the band.
 */
export function activeStepIndex(crossing: readonly number[]): number {
  const valid = crossing.filter(
    (index) => Number.isInteger(index) && index >= 0,
  );
  if (valid.length === 0) return -1;
  return Math.min(...valid);
}

/** The opacity of one step. Everything is readable while nothing is active. */
export function stepOpacity(active: number, index: number): number {
  if (active < 0) return 1;
  return active === index ? 1 : STEP_DIM_OPACITY;
}

/** True when a step number is drawn in accent. */
export function stepNumberIsAccent(active: number, index: number): boolean {
  return active === index;
}

/** True when a step should be at full strength. */
export function stepIsActive(active: number, index: number): boolean {
  return active < 0 || active === index;
}

/**
 * How much of the rail is filled, from 0 to 1. The fill reaches the bottom when
 * the last step is active, and sits empty while nothing is in the band.
 */
export function railProgress(active: number, stepCount: number): number {
  if (active < 0 || stepCount <= 0) return 0;
  return Math.min(1, (active + 1) / stepCount);
}

/**
 * Whether a step's small visual has already played. Each visual plays once, the
 * first time its step becomes active, and then holds its final frame.
 */
export function stepHasPlayed(
  played: readonly boolean[],
  index: number,
): boolean {
  return Boolean(played[index]);
}

/** The played flags after one activation, marking the new step as played. */
export function markStepPlayed(
  played: readonly boolean[],
  active: number,
): boolean[] {
  const next = [...played];
  if (active >= 0) next[active] = true;
  return next;
}
