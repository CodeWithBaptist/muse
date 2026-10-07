import * as React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLOSING_ACTION_ATTRIBUTE,
  CLOSING_BAND_TESTID,
  ClosingBandCanvas,
} from './ClosingBandCanvas';
import { BAND_BAR_WIDTH, BAND_HEIGHT } from '@/lib/landing-canvas';
import { beatClockSubscriberCount } from '@/lib/beat-clock';

/**
 * Component level checks for the closing band: one shared loop, the hover and
 * focus energy on the closing action, the pointer lifting the bars, reduced
 * motion painting a single static frame, and a clean unmount.
 *
 * jsdom has no canvas and no Path2D, so both are faked and the drawing is
 * recorded as fillRect calls, which is where the bar heights live.
 */

interface FakeBar {
  x: number;
  width: number;
  height: number;
  fill: string;
}

function createFakeContext() {
  const bars: FakeBar[] = [];
  let clears = 0;
  let gradients = 0;

  return {
    /**
     * Only the real bars. The solid dot and the two edge fades are also
     * fillRect calls, so they are filtered out by width and by fill style.
     */
    get bars() {
      return bars.filter(
        (bar) => bar.fill.startsWith('rgba') && bar.width < BAND_BAR_WIDTH + 0.01,
      );
    },
    get clears() {
      return clears;
    },
    /** Drops everything recorded so far. */
    reset() {
      bars.length = 0;
    },
    get gradients() {
      return gradients;
    },
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: '',
    strokeStyle: '',
    fillStyle: '',
    globalCompositeOperation: 'source-over',
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    stroke() {},
    fill() {},
    fillRect(x: number, _y: number, width: number, height: number) {
      bars.push({ x, width, height, fill: String(this.fillStyle) });
    },
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
      gradients += 1;
      return { addColorStop() {} };
    },
  };
}

function tallestBar(bars: FakeBar[]): number {
  return bars.reduce((tallest, bar) => Math.max(tallest, bar.height), 0);
}

/** The tallest bar near one position along the logo, in logo units. */
function barHeightNear(bars: FakeBar[], x: number, radius = 6): number {
  const near = bars.filter((bar) => Math.abs(bar.x - x) <= radius);
  return near.reduce((tallest, bar) => Math.max(tallest, bar.height), 0);
}

class FakePath2D {
  d: string;
  constructor(d: string) {
    this.d = d;
  }
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
      options?.signal?.addEventListener('abort', () => listeners.delete(listener));
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
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

const BAND = { width: 1200, height: BAND_HEIGHT };

/**
 * jsdom has no PointerEvent, so the pointer fields are defined on a plain event.
 * The canvas only reads clientX, clientY, and pointerType.
 */
function pointerMove(pointerType: string): Event {
  const event = new Event('pointermove');
  Object.defineProperty(event, 'clientX', { value: BAND.width / 2 });
  Object.defineProperty(event, 'clientY', { value: BAND.height / 2 });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  return event;
}

describe('ClosingBandCanvas', () => {
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
      right: BAND.width,
      bottom: BAND.height,
      width: BAND.width,
      height: BAND.height,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.stubGlobal('Path2D', FakePath2D as unknown as typeof Path2D);
    vi.stubGlobal('requestAnimationFrame', ((callback: (time: number) => void) => {
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
    const tree = (
      <section>
        <ClosingBandCanvas />
        <button type="button" {...{ [CLOSING_ACTION_ATTRIBUTE]: '' }}>
          Connect Spotify
        </button>
      </section>
    );
    return strict ? <React.StrictMode>{tree}</React.StrictMode> : tree;
  }

  function measuredHeight(
    interact?: (targets: { button: HTMLButtonElement; canvas: HTMLElement }) => void,
  ): number {
    const { container, unmount } = render(<Harness />);
    runFrames(200, 40);
    const button = container.querySelector(
      `[${CLOSING_ACTION_ATTRIBUTE}]`,
    ) as HTMLButtonElement;
    const canvas = container.querySelector(
      `[data-testid="${CLOSING_BAND_TESTID}"]`,
    ) as HTMLElement;
    if (interact) act(() => interact({ button, canvas }));
    context.reset();
    runFrames(1000, 40);
    const height = tallestBar(context.bars);
    unmount();
    return height;
  }

  it('is decorative, anchored to the bottom, and 240px tall', () => {
    const { container } = render(<Harness />);
    const canvas = container.querySelector(
      `[data-testid="${CLOSING_BAND_TESTID}"]`,
    ) as HTMLElement;

    expect(canvas).not.toBeNull();
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    expect(canvas.className).toContain('pointer-events-none');
    expect(canvas.className).toContain('absolute inset-x-0 bottom-0');
    expect(canvas.className).not.toContain('z-');
    expect(canvas.style.height).toBe(`${BAND_HEIGHT}px`);
  });

  it('builds a Path2D per wordmark piece and draws the edge fade', () => {
    const { unmount } = render(<Harness />);
    expect(context.bars.length).toBeGreaterThan(0);
    expect(context.gradients).toBe(2);
    unmount();
  });

  it('runs one shared loop, even under strict mode', () => {
    const { unmount } = render(<Harness strict />);

    expect(beatClockSubscriberCount()).toBe(1);
    expect(frameQueue.size).toBe(1);

    const painted = context.clears;
    runFrames(500, 3);
    expect(context.clears - painted).toBe(3);

    unmount();
    expect(beatClockSubscriberCount()).toBe(0);
    expect(frameQueue.size).toBe(0);
  });

  it('raises the bars while the closing action is hovered or focused', () => {
    const atRest = measuredHeight();

    const hovered = measuredHeight(({ button }) => {
      button.dispatchEvent(new Event('pointerover', { bubbles: true }));
    });
    expect(hovered).toBeGreaterThan(atRest);

    const focused = measuredHeight(({ button }) => {
      button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    expect(focused).toBeGreaterThan(atRest);

    const settled = measuredHeight(({ button }) => {
      button.dispatchEvent(new Event('pointerover', { bubbles: true }));
      runFrames(300, 120);
      button.dispatchEvent(new Event('pointerout', { bubbles: true }));
      runFrames(400, 200);
    });
    expect(settled).toBeLessThan(hovered);
  });

  it('lifts the bars under the pointer, and not for touch', () => {
    const { container, unmount } = render(<Harness />);
    runFrames(500, 3);
    const canvas = container.querySelector(
      `[data-testid="${CLOSING_BAND_TESTID}"]`,
    ) as HTMLElement;

    // The logo is centred, so the middle of the band is the middle of the mark.
    const middle = 137;

    // Both runs sample the same frame time, so the only difference is the
    // pointer. The mount paint is discarded first.
    context.reset();
    runFrames(600, 1);
    const plain = barHeightNear(context.bars, middle);
    expect(plain).toBeGreaterThan(0);

    context.reset();
    act(() => {
      canvas.dispatchEvent(pointerMove('mouse'));
    });
    runFrames(600, 1);
    expect(barHeightNear(context.bars, middle)).toBeGreaterThan(plain);

    context.reset();
    act(() => {
      canvas.dispatchEvent(pointerMove('touch'));
    });
    runFrames(600, 1);
    expect(barHeightNear(context.bars, middle)).toBeCloseTo(plain, 6);

    unmount();
  });

  it('paints one static frame and never starts the loop when motion is reduced', () => {
    media = makeMediaQuery(true);
    vi.stubGlobal('matchMedia', (() => media) as unknown as typeof matchMedia);

    const { unmount } = render(<Harness />);

    expect(beatClockSubscriberCount()).toBe(0);
    expect(frameQueue.size).toBe(0);
    expect(context.clears).toBe(1);
    expect(context.bars.length).toBeGreaterThan(0);

    unmount();
  });

  it('stops drawing while the band is offscreen or the tab is hidden', () => {
    const { unmount } = render(<Harness />);
    const observer = FakeIntersectionObserver.instances[0];

    act(() => {
      observer.trigger(false);
    });
    const before = context.clears;
    runFrames(2000, 8);
    expect(context.clears).toBe(before);

    act(() => {
      observer.trigger(true);
    });
    runFrames(3000, 2);
    expect(context.clears).toBe(before + 2);

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    const hidden = context.clears;
    runFrames(4000, 5);
    expect(context.clears).toBe(hidden);

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
    runFrames(5000, 2);
    expect(context.clears).toBe(hidden + 2);

    unmount();
    expect(observer.disconnected).toBe(true);
    expect(beatClockSubscriberCount()).toBe(0);
    expect(media.listenerCount()).toBe(0);
  });
});
