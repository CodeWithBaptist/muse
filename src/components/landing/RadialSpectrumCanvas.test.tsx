import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RadialSpectrumCanvas } from './RadialSpectrumCanvas';

/**
 * Component level checks for the hero canvas: one loop in strict mode, the
 * hover, press, and focus amplitude, touch behaviour, reduced motion painting a
 * single frame, and a clean unmount that stops the loop and removes listeners.
 *
 * jsdom has no canvas, no layout, and no observers, so the drawing goes to a
 * fake context, the loop is driven by hand, and `performance.now` is pinned to
 * zero so frame times are exactly the elapsed time since the spectrum started.
 * That makes two runs comparable frame for frame.
 */

interface Stroke {
  points: Array<{ x: number; y: number }>;
}

function createFakeContext() {
  const strokes: Stroke[] = [];
  const clears: number[] = [];
  let current: Stroke = { points: [] };

  return {
    strokes,
    clears,
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: '',
    strokeStyle: '',
    beginPath() {
      current = { points: [] };
    },
    moveTo(x: number, y: number) {
      current.points.push({ x, y });
    },
    lineTo(x: number, y: number) {
      current.points.push({ x, y });
    },
    stroke() {
      strokes.push(current);
    },
    clearRect() {
      clears.push(1);
    },
    setTransform() {},
  };
}

/** Total stroke length since the last reset. Amplitude scales this directly. */
function strokeLength(strokes: Stroke[]): number {
  return strokes.reduce((total, stroke) => {
    const [a, b] = stroke.points;
    if (!a || !b) return total;
    return total + Math.hypot(b.x - a.x, b.y - a.y);
  }, 0);
}

class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class FakeIntersectionObserver {
  constructor(_callback: unknown) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}

function makeMediaQuery(matches: boolean) {
  const listeners = new Set<() => void>();
  return {
    matches,
    media: '',
    addEventListener: (
      _type: string,
      listener: () => void,
      options?: AddEventListenerOptions,
    ) => {
      listeners.add(listener);
      // A real EventTarget drops the listener when the signal aborts.
      options?.signal?.addEventListener('abort', () => listeners.delete(listener));
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
    dispatch: () => listeners.forEach((listener) => listener()),
    listenerCount: () => listeners.size,
  };
}

let frameQueue = new Map<number, (time: number) => void>();
let scheduled = 0;

/** Runs the pending frame callbacks at an explicit time, in order. */
function stepTo(time: number) {
  const pending = [...frameQueue.values()];
  frameQueue.clear();
  act(() => {
    for (const callback of pending) callback(time);
  });
}

function runFrames(fromTime: number, count: number, step = 16): number {
  let time = fromTime;
  for (let index = 0; index < count; index += 1) {
    stepTo(time);
    time += step;
  }
  return time;
}

describe('RadialSpectrumCanvas', () => {
  let context: ReturnType<typeof createFakeContext>;
  let media: ReturnType<typeof makeMediaQuery>;

  beforeEach(() => {
    context = createFakeContext();
    media = makeMediaQuery(false);
    frameQueue = new Map();
    scheduled = 0;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => context as unknown as CanvasRenderingContext2D,
    );
    // jsdom has no layout, so the canvas reports a real hero box instead.
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1200,
      bottom: 700,
      width: 1200,
      height: 700,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.stubGlobal('requestAnimationFrame', ((callback: (time: number) => void) => {
      scheduled += 1;
      frameQueue.set(scheduled, callback);
      return scheduled;
    }) as typeof requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', ((handle: number) => {
      frameQueue.delete(handle);
    }) as typeof cancelAnimationFrame);
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    vi.stubGlobal('matchMedia', (() => media) as unknown as typeof matchMedia);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function Harness({ strict = false }: { strict?: boolean }) {
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const pulseRef = React.useRef<HTMLSpanElement | null>(null);
    const tree = (
      <section>
        <RadialSpectrumCanvas contentRef={contentRef} pulseRef={pulseRef} />
        <div ref={contentRef} data-testid="hero-content">
          <span ref={pulseRef} data-testid="dot" />
          <button type="button" data-muse-hero-action>
            Connect Spotify
          </button>
        </div>
      </section>
    );
    return strict ? <React.StrictMode>{tree}</React.StrictMode> : tree;
  }

  /** Total drawn length over a fixed window after an optional interaction. */
  function totalOverWindow(
    window: { from: number; frames: number },
    interact?: (targets: {
      button: HTMLButtonElement;
      host: HTMLElement;
    }) => void,
  ): number {
    const { container, unmount } = render(<Harness />);
    runFrames(200, 40);
    const button = container.querySelector('[data-muse-hero-action]')!;
    const host = container.querySelector('section')!;
    if (interact) act(() => interact({ button, host }));
    context.strokes.length = 0;
    runFrames(window.from, window.frames);
    const total = strokeLength(context.strokes);
    unmount();
    return total;
  }

  it('runs one loop under strict mode and paints every frame', () => {
    const { unmount } = render(<Harness strict />);

    // Strict mode mounts, unmounts, and mounts again: the first loop is
    // cancelled by the first cleanup, so only one loop may be pending.
    expect(frameQueue.size).toBe(1);

    const clearedBefore = context.clears.length;
    runFrames(0, 3);
    expect(context.clears.length).toBe(clearedBefore + 3);
    expect(frameQueue.size).toBe(1);

    // The ring only starts building after the headline reveal has begun.
    runFrames(100, 50);
    expect(context.strokes.length).toBe(0);
    runFrames(1000, 120);
    expect(context.strokes.length).toBeGreaterThan(0);

    unmount();
    expect(frameQueue.size).toBe(0);
  });

  it('lifts the amplitude while an action is hovered, and eases back after', () => {
    const window = { from: 2400, frames: 40 };
    const resting = totalOverWindow(window);
    const hovered = totalOverWindow(window, ({ button }) => {
      button.dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, clientX: 40, clientY: 40 }),
      );
    });

    expect(resting).toBeGreaterThan(0);
    expect(hovered).toBeGreaterThan(resting * 1.05);

    // Moving off the action eases the ring back toward rest.
    const left = totalOverWindow(window, ({ button, host }) => {
      button.dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, clientX: 40, clientY: 40 }),
      );
      // Off the hero: the hover ends and there is no pointer pull.
      host.dispatchEvent(
        new MouseEvent('pointermove', {
          bubbles: true,
          clientX: -100,
          clientY: -100,
        }),
      );
    });
    expect(left).toBeLessThan(hovered);
    expect(left / resting).toBeLessThan(1.35);
  });

  it('lifts the amplitude on keyboard focus and on touch press', () => {
    const window = { from: 2400, frames: 40 };
    const resting = totalOverWindow(window);

    const focused = totalOverWindow(window, ({ button }) => {
      button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    expect(focused).toBeGreaterThan(resting * 1.05);

    const pressed = totalOverWindow(window, ({ button }) => {
      button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });
    expect(pressed).toBeGreaterThan(resting * 1.05);
  });

  it('ignores touch pointer moves and pointer pull follows the mouse only', () => {
    const window = { from: 2400, frames: 40 };
    const resting = totalOverWindow(window);

    // A touch move over an action is a press, not a hover, and it never pulls
    // the bars, so the window stays close to the resting length.
    const touch = totalOverWindow(window, ({ button }) => {
      const event = new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 40,
        clientY: 40,
      });
      Object.defineProperty(event, 'pointerType', { value: 'touch' });
      button.dispatchEvent(event);
    });
    expect(touch).toBe(resting);

    // A mouse move over the ring pulls the bars that face the pointer.
    const pulled = totalOverWindow(window, ({ host }) => {
      host.dispatchEvent(
        new MouseEvent('pointermove', {
          bubbles: true,
          clientX: 1000,
          clientY: 350,
        }),
      );
    });
    expect(pulled).toBeGreaterThan(resting);
  });

  it('paints one static frame and never starts the loop when motion is reduced', () => {
    media = makeMediaQuery(true);
    vi.stubGlobal('matchMedia', (() => media) as unknown as typeof matchMedia);

    render(<Harness />);

    expect(frameQueue.size).toBe(0);
    const clears = context.clears.length;
    const strokes = context.strokes.length;
    expect(clears).toBeGreaterThan(0);
    expect(strokes).toBeGreaterThan(0);

    // Nothing scheduled means nothing can paint again, and the pulse is off.
    const dot = screen.getByTestId('dot');
    const scale = dot.style.transform;
    runFrames(3000, 5);
    expect(context.clears.length).toBe(clears);
    expect(frameQueue.size).toBe(0);
    expect(dot.style.transform).toBe(scale);
    expect(dot.style.transform).toBe('');
  });

  it('pulses the dot from the same loop after the entrance settles', () => {
    render(<Harness />);

    const dot = screen.getByTestId('dot');
    runFrames(1000, 10);
    expect(dot.style.transform).toBe('');

    // On a beat after the dot has settled the loop writes a scale.
    let sawPulse = false;
    for (let time = 1500; time < 2200; time += 16) {
      stepTo(time);
      if (dot.style.transform.startsWith('scale(')) {
        sawPulse = true;
        const value = Number.parseFloat(
          dot.style.transform.replace('scale(', '').replace(')', ''),
        );
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(1.17);
      }
    }
    expect(sawPulse).toBe(true);
  });

  it('removes every listener on unmount', () => {
    const { container, unmount } = render(<Harness />);
    runFrames(1200, 2);
    const host = container.querySelector('section')!;

    expect(media.listenerCount()).toBe(1);
    unmount();
    // The abort controller drops the media query listener, and the loop stops.
    expect(media.listenerCount()).toBe(0);

    const before = context.clears.length;
    act(() => {
      // Off the hero: the hover ends and there is no pointer pull.
      host.dispatchEvent(
        new MouseEvent('pointermove', {
          bubbles: true,
          clientX: -100,
          clientY: -100,
        }),
      );
      document.dispatchEvent(new Event('visibilitychange'));
    });
    runFrames(1400, 2);
    expect(context.clears.length).toBe(before);
  });
});
