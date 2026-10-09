/**
 * The one beat clock for the landing page.
 *
 * Everything that needs a beat reads it from here: the hero record canvas, the
 * closing band canvas, and the two accent dots in the header and the hero. There
 * is exactly one requestAnimationFrame loop in the whole page, started by the
 * first subscriber and stopped when the last one leaves, so React strict mode
 * mounting an effect twice can never leave two loops running.
 *
 * The loop pauses while the document is hidden. Whether a given canvas draws is
 * decided by its own IntersectionObserver, never by this module.
 */

export const BEAT_BPM = 96;
export const BEAT_MS = 60_000 / BEAT_BPM;
/** The envelope decays by this factor across one beat. */
export const BEAT_DECAY = 5.5;

/** Position inside the current beat, from 0 to 1. */
export function beatPhase(timeMs: number): number {
  const wrapped = ((timeMs % BEAT_MS) + BEAT_MS) % BEAT_MS;
  return wrapped / BEAT_MS;
}

/** 1 on the beat, decaying to exp(-5.5) by the end of it. */
export function beatEnvelope(timeMs: number): number {
  return Math.exp(-beatPhase(timeMs) * BEAT_DECAY);
}

/** Seconds since the loop epoch, for the drawing functions. */
export function beatSeconds(timeMs: number): number {
  return timeMs / 1000;
}

export type BeatListener = (nowMs: number) => void;

let listeners = new Set<BeatListener>();
let frameHandle = 0;

function tick(nowMs: number) {
  // The loop keeps running while anything is subscribed, it simply does no work
  // while the tab is hidden. rAF is throttled by the browser anyway, and this
  // guard makes the pause explicit for tests.
  frameHandle = requestAnimationFrame(tick);
  if (document.hidden) return;
  for (const listener of listeners) listener(nowMs);
}

/** True while the shared loop is scheduled. */
export function isBeatClockRunning(): boolean {
  return frameHandle !== 0;
}

/** How many listeners the shared loop currently feeds. */
export function beatClockSubscriberCount(): number {
  return listeners.size;
}

/**
 * Joins the shared loop. The returned function leaves it, and the loop stops
 * with the last subscriber, so nothing keeps running after an unmount.
 */
export function subscribeBeat(listener: BeatListener): () => void {
  listeners.add(listener);
  if (frameHandle === 0) {
    frameHandle = requestAnimationFrame(tick);
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    listeners.delete(listener);
    if (listeners.size === 0 && frameHandle !== 0) {
      cancelAnimationFrame(frameHandle);
      frameHandle = 0;
    }
  };
}
