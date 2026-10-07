/**
 * The rolling word.
 *
 * One very large line cycles through a fixed list of phrases like a slot
 * machine: the column moves up one phrase every 2.2 seconds over 600ms, and the
 * first phrase is repeated at the end of the column so the last move can run its
 * transition before the column jumps back with the transition off.
 *
 * All of the index and offset math lives here so it can be unit tested, and so
 * the component is nothing but the window, the column, and a timer.
 */

/** How long one phrase stays on screen before it rolls. */
export const ROLL_INTERVAL_MS = 2200;
/** How long the roll itself takes. */
export const ROLL_DURATION_MS = 600;
export const ROLL_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

/**
 * The number of positions in the column: one per phrase, plus the repeated
 * first phrase that makes the loop seamless.
 */
export function rollingPositionCount(phraseCount: number): number {
  return Math.max(0, phraseCount) + 1;
}

/** Which phrase a position shows. The extra position repeats the first. */
export function rollingPhraseIndex(position: number, phraseCount: number): number {
  if (phraseCount <= 0) return 0;
  return ((position % phraseCount) + phraseCount) % phraseCount;
}

/** True on the repeated phrase at the end of the column. */
export function rollingIsRepeat(position: number, phraseCount: number): boolean {
  return phraseCount > 0 && position % rollingPositionCount(phraseCount) === phraseCount;
}

/** The step for one elapsed time. The step is what the timer increments. */
export function rollingStepAt(elapsedMs: number, intervalMs: number = ROLL_INTERVAL_MS): number {
  return Math.max(0, Math.floor(Math.max(0, elapsedMs) / Math.max(1, intervalMs)));
}

/** The column position for one step, wrapping through the repeated phrase. */
export function rollingPosition(step: number, phraseCount: number): number {
  const count = rollingPositionCount(phraseCount);
  if (count <= 0) return 0;
  return ((step % count) + count) % count;
}

/**
 * The vertical offset of the column, in line heights. Negative moves the column
 * up, which is what the window shows.
 */
export function rollingOffset(position: number): number {
  return position > 0 ? -position : 0;
}

/**
 * Every move animates over the same 600ms, including the move onto the repeated
 * phrase, because that move is the visible roll. The only move that must not
 * animate is the jump back to the first phrase.
 *
 * How long to wait after the repeated phrase arrives before making that jump,
 * with the transition switched off.
 */
export function rollingResetDelay(): number {
  return ROLL_DURATION_MS;
}

/**
 * True when the column is showing the repeated phrase and should jump back
 * without a transition.
 */
export function rollingShouldReset(position: number, phraseCount: number): boolean {
  return rollingIsRepeat(position, phraseCount);
}
