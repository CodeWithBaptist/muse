import * as React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HERO_ACTION_ATTRIBUTE,
  RECORD_GROOVES_TESTID,
  RecordGroovesCanvas,
} from './RecordGroovesCanvas';
import { HERO_DOT_PULSE_SCALE, HERO_DOT_SETTLE_MS } from '@/lib/hero-entrance';
import { beatClockSubscriberCount } from '@/lib/beat-clock';

/**
 * Component level checks for the hero canvas: one shared loop in strict mode,
 * the hover, focus, and touch energy, reduced motion painting a single static
 * frame, the dot pulse, and a clean unmount that stops the loop and removes
 * every listener.
 *
 * jsdom has no canvas, no layout, and no observers, so the drawing goes to a
 * fake context, the loop is driven by hand, and `performance.now` is pinned so
 * frame times are exactly the elapsed time.
 */

interface Stroke {
  points: Array<{ x: number; y: number }>;
  alpha: number;
}

function createFakeContext() {
  const strokes: Stroke[] = [];
  let clears = 0;
  let current: Stroke = { points: [], alpha: 1 };

  return {
    strokes,
    get clears() {
      return clears;
    },
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: '',
    strokeStyle: '',
    fillStyle: '',
    globalCompositeOperation: 'source-over',
    beginPath() {
      current = { points: [], alpha: this.globalAlpha };
    },
    moveTo(x: number, y: number) {
      current.points.push({ x, y });
    },
    lineTo(x: number, y: number) {
      current.points.push({ x, y });
    },
    arc() {},
    stroke() {
      strokes.push(current);
    },
    fill() {},
    fillRect() {},
    clearRect() {
      clears += 1;
    },
    save() {},
    restore() {},
    translate() {},
    scale() {},
    clip() {},
    setTransform() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
  };
}

/**
 * How wavy the grooves are, which is exactly what the hover energy drives:
 * distortion bends each circle, so the spread of radii inside one stroke grows
 * with it.
 */
function waviness(strokes: Stroke[], cx: number, cy: number): number {
  return strokes.reduce((total, stroke) => {
    if (stroke.points.length < 8) return total;
    const radii = stroke.points.map((point) =>
      Math.hypot(point.x - cx, point.y - cy),
    );
    return total + (Math.max(...radii) - Math.min(...radii));
  }, 0);
}

class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  disconnected = false;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }
  observe() {}
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  trigger(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
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
      options?.signal?.addEventListener('abort', () =>
        listeners.delete(listener),
      );
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
    dispatch: () => listeners.forEach((listener) => listener()),
    listenerCount: () => listeners.size,
  };
}

let frameQueue = new Map<number, (time: number) => void>();
let nextHandle = 0;

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

const HERO = { width: 1200, height: 700 };

describe('RecordGroovesCanvas', () => {
  let context: ReturnType<typeof createFakeContext>;
  let media: ReturnType<typeof makeMediaQuery>;

  beforeEach(() => {
    context = createFakeContext();
    media = makeMediaQuery(false);
    frameQueue = new Map();
    nextHandle = 0;
    FakeIntersectionObserver.instances = [];

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => context as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(
      HTMLCanvasElement.prototype,
      'getBoundingClientRect',
    ).mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: HERO.width,
      bottom: HERO.height,
      width: HERO.width,
      height: HERO.height,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.stubGlobal('requestAnimationFrame', ((
      callback: (time: number) => void,
    ) => {
      nextHandle += 1;
      frameQueue.set(nextHandle, callback);
      return nextHandle;
    }) as typeof requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', ((handle: number) => {
      frameQueue.delete(handle);
    }) as typeof cancelAnimationFrame);
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.stubGlobal(
      'IntersectionObserver',
      FakeIntersectionObserver as unknown as typeof IntersectionObserver,
    );
    vi.stubGlobal('matchMedia', (() => media) as unknown as typeof matchMedia);
    vi.stubGlobal('getComputedStyle', (() => ({
      getPropertyValue: () => '',
    })) as unknown as typeof getComputedStyle);
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
        <RecordGroovesCanvas contentRef={contentRef} pulseRef={pulseRef} />
        <div ref={contentRef} data-testid="hero-content">
          <span ref={pulseRef} data-testid="dot" />
          <button type="button" {...{ [HERO_ACTION_ATTRIBUTE]: '' }}>
            Connect Spotify
          </button>
        </div>
      </section>
    );
    return strict ? <React.StrictMode>{tree}</React.StrictMode> : tree;
  }

  /** Waviness over a fixed window of frames, after an optional interaction. */
  function measuredWaviness(
    interact?: (targets: {
      button: HTMLButtonElement;
      host: HTMLElement;
    }) => void,
  ): number {
    const { container, unmount } = render(<Harness />);
    runFrames(200, 40);
    const button = container.querySelector(
      `[${HERO_ACTION_ATTRIBUTE}]`,
    ) as HTMLButtonElement;
    const host = container.querySelector('section') as HTMLElement;
    if (interact) act(() => interact({ button, host }));
    context.strokes.length = 0;
    runFrames(1000, 40);
    const total = waviness(context.strokes, HERO.width / 2, HERO.height / 2);
    unmount();
    return total;
  }

  it('is decorative, behind the content, and never clickable', () => {
    const { container } = render(<Harness />);
    const canvas = container.querySelector(
      `[data-testid="${RECORD_GROOVES_TESTID}"]`,
    );

    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute('aria-hidden')).toBe('true');
    expect(canvas?.className).toContain('pointer-events-none');
    expect(canvas?.className).toContain('absolute inset-0');
    // No stacking class: the content carries its own z-index instead.
    expect(canvas?.className).not.toContain('z-');
  });

  it('runs one shared loop, even under strict mode', () => {
    const { unmount } = render(<Harness strict />);

    expect(beatClockSubscriberCount()).toBe(1);
    expect(frameQueue.size).toBe(1);

    const paintedOnMount = context.clears;
    context.strokes.length = 0;
    runFrames(500, 3);
    // Three frames, three clears: one loop, not two.
    expect(context.clears - paintedOnMount).toBe(3);

    unmount();
    expect(beatClockSubscriberCount()).toBe(0);
    expect(frameQueue.size).toBe(0);
  });

  it('lifts the grooves while an action is hovered, and settles back', () => {
    const atRest = measuredWaviness();
    // Delegated listeners read event.target, so the events come from the button
    // and bubble up to the hero, exactly as they do in a browser.
    const hovered = measuredWaviness(({ button }) => {
      button.dispatchEvent(new Event('pointerover', { bubbles: true }));
    });

    expect(hovered).toBeGreaterThan(atRest);

    const released = measuredWaviness(({ button }) => {
      button.dispatchEvent(new Event('pointerover', { bubbles: true }));
      runFrames(300, 120);
      button.dispatchEvent(new Event('pointerout', { bubbles: true }));
      runFrames(400, 200);
    });

    expect(released).toBeLessThan(hovered);
    expect(Math.abs(released - atRest)).toBeLessThan(hovered - atRest);
  });

  it('lifts the grooves on keyboard focus and on a touch press', () => {
    const atRest = measuredWaviness();

    const focused = measuredWaviness(({ button }) => {
      button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    expect(focused).toBeGreaterThan(atRest);

    const touched = measuredWaviness(({ button }) => {
      button.dispatchEvent(new Event('touchstart', { bubbles: true }));
    });
    expect(touched).toBeGreaterThan(atRest);
  });

  it('ignores hover on anything that is not a hero action', () => {
    const atRest = measuredWaviness();
    const elsewhere = measuredWaviness(({ host }) => {
      const other = document.createElement('span');
      host.appendChild(other);
      other.dispatchEvent(new Event('pointerover', { bubbles: true }));
    });
    expect(Math.abs(elsewhere - atRest)).toBeLessThan(atRest * 0.05);
  });

  it('paints one static frame and never starts the loop when motion is reduced', () => {
    media = makeMediaQuery(true);
    vi.stubGlobal('matchMedia', (() => media) as unknown as typeof matchMedia);

    const { container } = render(<Harness />);

    expect(beatClockSubscriberCount()).toBe(0);
    expect(frameQueue.size).toBe(0);
    expect(context.clears).toBe(1);
    expect(context.strokes.length).toBeGreaterThan(0);

    const dot = container.querySelector('[data-testid="dot"]') as HTMLElement;
    expect(dot.style.transform).toBe('');
  });

  it('pulses the dot on the shared beat once the entrance settles', () => {
    const { container } = render(<Harness />);
    const dot = container.querySelector('[data-testid="dot"]') as HTMLElement;

    runFrames(HERO_DOT_SETTLE_MS - 100, 3);
    expect(dot.style.transform).toBe('');

    runFrames(HERO_DOT_SETTLE_MS + 4, 1);
    expect(dot.style.transform).toMatch(/^scale\(1\./);
    const scale = Number.parseFloat(
      dot.style.transform.replace('scale(', '').replace(')', ''),
    );
    expect(scale).toBeGreaterThan(1);
    expect(scale).toBeLessThanOrEqual(1 + HERO_DOT_PULSE_SCALE + 0.0001);
  });

  it('stops drawing while the hero is offscreen', () => {
    const { unmount } = render(<Harness />);
    const observer = FakeIntersectionObserver.instances[0];

    act(() => {
      observer.trigger(false);
    });
    const before = context.clears;
    runFrames(2000, 10);
    expect(context.clears).toBe(before);

    act(() => {
      observer.trigger(true);
    });
    runFrames(3000, 3);
    expect(context.clears).toBe(before + 3);

    unmount();
    expect(observer.disconnected).toBe(true);
  });

  it('does no work while the tab is hidden', () => {
    const { unmount } = render(<Harness />);

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    const before = context.clears;
    runFrames(2000, 6);
    expect(context.clears).toBe(before);

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
    runFrames(3000, 2);
    expect(context.clears).toBe(before + 2);

    unmount();
  });

  it('removes every listener on unmount', () => {
    const { container, unmount } = render(<Harness />);
    const host = container.querySelector('section') as HTMLElement;
    const button = container.querySelector(
      `[${HERO_ACTION_ATTRIBUTE}]`,
    ) as HTMLButtonElement;

    // One from the canvas, one from the display preferences store, which
    // also watches reduced motion while the canvas is subscribed to it.
    expect(media.listenerCount()).toBe(2);

    unmount();

    // The AbortController dropped the hover, focus, touch, and preference
    // listeners, and the loop and observers went with them.
    expect(media.listenerCount()).toBe(0);
    expect(beatClockSubscriberCount()).toBe(0);
    expect(FakeIntersectionObserver.instances[0].disconnected).toBe(true);

    const before = context.clears;
    act(() => {
      button.dispatchEvent(new Event('pointerover', { bubbles: true }));
      host.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    runFrames(5000, 4);
    expect(context.clears).toBe(before);
  });
});
