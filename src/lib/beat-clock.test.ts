import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BEAT_BPM,
  BEAT_DECAY,
  BEAT_MS,
  beatClockSubscriberCount,
  beatEnvelope,
  beatPhase,
  isBeatClockRunning,
  subscribeBeat,
} from './beat-clock';

let scheduled = new Map<number, (now: number) => void>();
let nextHandle = 1;

beforeEach(() => {
  scheduled = new Map();
  nextHandle = 1;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const handle = nextHandle++;
    scheduled.set(handle, callback);
    return handle;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => {
    scheduled.delete(handle);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Runs every callback that is still scheduled, like a browser frame. */
function runFrame(now: number) {
  const callbacks = [...scheduled.values()];
  scheduled.clear();
  callbacks.forEach((callback) => callback(now));
}

describe('beat clock timing', () => {
  it('runs at 96 BPM, one beat every 625ms', () => {
    expect(BEAT_BPM).toBe(96);
    expect(BEAT_MS).toBe(625);
    expect(60_000 / BEAT_BPM).toBe(BEAT_MS);
  });

  it('wraps the phase inside one beat', () => {
    expect(beatPhase(0)).toBe(0);
    expect(beatPhase(312.5)).toBeCloseTo(0.5);
    expect(beatPhase(625)).toBe(0);
    expect(beatPhase(1250)).toBe(0);
    expect(beatPhase(-625)).toBe(0);
  });

  it('envelopes from 1 on the beat, decaying by exp(-5.5)', () => {
    expect(BEAT_DECAY).toBe(5.5);
    expect(beatEnvelope(0)).toBe(1);
    expect(beatEnvelope(625)).toBe(1);
    expect(beatEnvelope(312.5)).toBeCloseTo(Math.exp(-0.5 * 5.5), 6);
    expect(beatEnvelope(624)).toBeLessThan(0.01);
    expect(beatEnvelope(1000)).toBeGreaterThan(beatEnvelope(1200));
  });
});

describe('beat clock loop', () => {
  it('starts one loop and never a second', () => {
    const release = subscribeBeat(() => {});
    // One frame is pending, and no frame has run yet.
    const pendingFrames = scheduled.size;
    expect(pendingFrames).toBe(1);

    const releaseSecond = subscribeBeat(() => {});
    // A second subscriber joins the running loop instead of starting a new one.
    expect(scheduled.size).toBe(pendingFrames);
    expect(beatClockSubscriberCount()).toBe(2);
    expect(isBeatClockRunning()).toBe(true);

    releaseSecond();
    release();
    expect(beatClockSubscriberCount()).toBe(0);
    expect(isBeatClockRunning()).toBe(false);
  });

  it('releasing twice does not stop a loop someone else is using', () => {
    const release = subscribeBeat(() => {});
    const releaseSecond = subscribeBeat(() => {});

    releaseSecond();
    releaseSecond();
    expect(beatClockSubscriberCount()).toBe(1);
    expect(isBeatClockRunning()).toBe(true);

    release();
    expect(isBeatClockRunning()).toBe(false);
  });

  it('feeds every listener once per frame', () => {
    const first = vi.fn();
    const second = vi.fn();
    const releaseFirst = subscribeBeat(first);
    const releaseSecond = subscribeBeat(second);

    runFrame(100);
    expect(first).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledWith(100);
    expect(second).toHaveBeenCalledTimes(1);

    releaseFirst();
    releaseSecond();
  });

  it('does no work while the document is hidden', () => {
    const listener = vi.fn();
    const release = subscribeBeat(listener);

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    runFrame(200);
    expect(listener).not.toHaveBeenCalled();

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
    runFrame(400);
    expect(listener).toHaveBeenCalledWith(400);

    release();
  });

  it('survives strict mode, where the effect mounts and unmounts once', () => {
    const listener = vi.fn();
    const firstRelease = subscribeBeat(listener);
    firstRelease();
    const secondRelease = subscribeBeat(listener);

    runFrame(50);
    expect(listener).toHaveBeenCalledTimes(1);

    secondRelease();
    expect(isBeatClockRunning()).toBe(false);
  });
});
