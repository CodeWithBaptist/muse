import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HowItWorks,
  LANDING_STEPS,
  STEP_ACTION_TOTAL_MS,
  STEP_THINK_LINES,
  STEP_THINK_TOTAL_MS,
  STEP_TYPE_TEXT,
  STEP_TYPE_TOTAL_MS,
  STEP_WHY_TEXT,
  STEP_WHY_TOTAL_MS,
  stepActionStatus,
  stepThinkLineIndex,
} from './HowItWorks';
import { STEP_DIM_OPACITY } from '@/lib/landing-steps';

vi.mock('motion/react', async () => {
  const { motionMock } = await import('@/test/motion-mock');
  return motionMock;
});

/**
 * The rail: every step starts visible, the one crossing the middle band becomes
 * active and dims the others, and each small visual plays once and then holds
 * its final frame.
 */

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  disconnected = false;
  observed: Element[] = [];
  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.callback = callback;
    this.options = options;
    FakeIntersectionObserver.instances.push(this);
  }
  observe(element: Element) {
    this.observed.push(element);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  trigger(targets: Array<{ element: Element; isIntersecting: boolean }>) {
    this.callback(
      targets.map(
        ({ element, isIntersecting }) =>
          ({ target: element, isIntersecting }) as IntersectionObserverEntry,
      ),
      this as unknown as IntersectionObserver,
    );
  }
}

function makeMediaQuery(matches: boolean) {
  return {
    matches,
    media: '',
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

let media = makeMediaQuery(false);

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

function stepNodes(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-step]')];
}

function opacityOf(index: number): string {
  return stepNodes()[index].style.opacity;
}

function railProgress(): string | null {
  return (
    document
      .querySelector('[data-testid="how-it-works-rail"]')
      ?.getAttribute('data-progress') ?? null
  );
}

describe('HowItWorks', () => {
  beforeEach(() => {
    media = makeMediaQuery(false);
    FakeIntersectionObserver.instances = [];
    vi.useFakeTimers({
      toFake: [
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
        'performance',
      ],
    });
    vi.stubGlobal(
      'IntersectionObserver',
      FakeIntersectionObserver as unknown as typeof IntersectionObserver,
    );
    vi.stubGlobal('matchMedia', (() => media) as unknown as typeof matchMedia);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders the four steps with the copy from the brief', () => {
    render(<HowItWorks />);

    expect(
      screen.getByRole('heading', { name: 'Four steps. No filters.' }),
    ).toBeDefined();
    expect(screen.getByText('How it works')).toBeDefined();
    expect(stepNodes()).toHaveLength(4);
    for (const step of LANDING_STEPS) {
      expect(screen.getByText(step.title)).toBeDefined();
      expect(screen.getByText(step.description)).toBeDefined();
    }
    expect(document.getElementById('how-it-works')).not.toBeNull();
  });

  it('starts with every step visible, so nothing depends on JavaScript', () => {
    render(<HowItWorks />);

    for (let index = 0; index < 4; index += 1) {
      expect(opacityOf(index)).toBe('1');
    }
    // The rail starts empty and grows with a transform, never with height.
    expect(railProgress()).toBe('0.000');
    const rail = document.querySelector(
      '[data-testid="how-it-works-rail"]',
    ) as HTMLElement;
    expect(rail.style.transform).toBe('scaleY(0)');
    expect(rail.className).toContain('muse-rail-fill');
  });

  it('watches the middle band of the viewport, at minus 42 percent', () => {
    render(<HowItWorks />);

    const band = FakeIntersectionObserver.instances[0];
    const view = FakeIntersectionObserver.instances[1];
    expect(band.options?.rootMargin).toBe('-42% 0px -42% 0px');
    expect(view.options?.threshold).toBe(0);
    expect(band.observed).toHaveLength(4);
    expect(view.observed).toHaveLength(4);
  });

  it('brightens the active step and dims the others', () => {
    render(<HowItWorks />);
    const band = FakeIntersectionObserver.instances[0];
    const nodes = stepNodes();

    act(() => {
      band.trigger([{ element: nodes[2], isIntersecting: true }]);
    });

    expect(opacityOf(2)).toBe('1');
    expect(opacityOf(0)).toBe(String(STEP_DIM_OPACITY));
    expect(opacityOf(1)).toBe(String(STEP_DIM_OPACITY));
    expect(opacityOf(3)).toBe(String(STEP_DIM_OPACITY));
    expect(railProgress()).toBe('0.750');
    expect(nodes[2].getAttribute('data-current')).toBe('true');
    expect(nodes[0].getAttribute('data-current')).toBe('false');
  });

  it('plays each visual once, the first time its step becomes active', async () => {
    render(<HowItWorks />);
    const band = FakeIntersectionObserver.instances[0];
    const view = FakeIntersectionObserver.instances[1];
    const nodes = stepNodes();

    // Off screen: nothing plays.
    act(() => {
      view.trigger(
        nodes.map((element) => ({ element, isIntersecting: false })),
      );
      band.trigger([{ element: nodes[0], isIntersecting: true }]);
    });
    await advance(STEP_TYPE_TOTAL_MS);
    expect(document.body.textContent).not.toContain(STEP_TYPE_TEXT);

    // On screen and active: the typing visual runs to the end and holds.
    act(() => {
      view.trigger([{ element: nodes[0], isIntersecting: true }]);
    });
    await advance(STEP_TYPE_TOTAL_MS + 200);
    expect(document.body.textContent).toContain(STEP_TYPE_TEXT);

    // Scrolling away does not restart it.
    act(() => {
      band.trigger([{ element: nodes[1], isIntersecting: true }]);
    });
    await advance(200);
    expect(document.body.textContent).toContain(STEP_TYPE_TEXT);
  });

  it('runs the understanding visual to a frozen answer', async () => {
    render(<HowItWorks />);
    const band = FakeIntersectionObserver.instances[0];
    const view = FakeIntersectionObserver.instances[1];
    const nodes = stepNodes();

    act(() => {
      view.trigger([{ element: nodes[1], isIntersecting: true }]);
      band.trigger([{ element: nodes[1], isIntersecting: true }]);
    });

    expect(document.body.textContent).toContain(STEP_THINK_LINES[0]);
    await advance(1000);
    expect(document.body.textContent).toContain(STEP_THINK_LINES[1]);
    await advance(STEP_THINK_TOTAL_MS);
    expect(document.body.textContent).toContain(STEP_THINK_LINES[2]);

    const equalizer = document.querySelector('[data-testid="equalizer"]');
    expect(equalizer?.getAttribute('data-paused')).toBe('true');
  });

  it('shows the reason line after the rows rise', async () => {
    render(<HowItWorks />);
    const band = FakeIntersectionObserver.instances[0];
    const view = FakeIntersectionObserver.instances[1];
    const nodes = stepNodes();

    act(() => {
      view.trigger([{ element: nodes[2], isIntersecting: true }]);
      band.trigger([{ element: nodes[2], isIntersecting: true }]);
    });
    expect(document.body.textContent).toContain(STEP_WHY_TEXT);

    await advance(STEP_WHY_TOTAL_MS + 100);
    const line = screen.getByText(STEP_WHY_TEXT);
    expect(line.style.opacity).toBe('1');
  });

  it('walks the list actions through their states', async () => {
    render(<HowItWorks />);
    const band = FakeIntersectionObserver.instances[0];
    const view = FakeIntersectionObserver.instances[1];
    const nodes = stepNodes();

    act(() => {
      view.trigger([{ element: nodes[3], isIntersecting: true }]);
      band.trigger([{ element: nodes[3], isIntersecting: true }]);
    });

    expect(
      document
        .querySelector('[data-testid="sample-list-actions"]')
        ?.getAttribute('data-status'),
    ).toBe('idle');

    await advance(STEP_ACTION_TOTAL_MS + 200);
    expect(
      document
        .querySelector('[data-testid="sample-list-actions"]')
        ?.getAttribute('data-status'),
    ).toBe('open');
    // The sample control is inert, so it never renders a real link.
    expect(
      document.querySelector('a[href^="https://open.spotify.com"]'),
    ).toBeNull();
  });

  it('maps the script timings to the right states', () => {
    expect(stepThinkLineIndex(0)).toBe(0);
    expect(stepThinkLineIndex(900)).toBe(1);
    expect(stepThinkLineIndex(STEP_THINK_TOTAL_MS)).toBe(2);

    expect(stepActionStatus(0)).toBe('idle');
    expect(stepActionStatus(400)).toBe('loading');
    expect(stepActionStatus(1300)).toBe('success');
    expect(stepActionStatus(STEP_ACTION_TOTAL_MS)).toBe('open');
  });

  it('cleans both observers up on unmount', () => {
    const view = render(<HowItWorks />);
    view.unmount();

    expect(FakeIntersectionObserver.instances[0].disconnected).toBe(true);
    expect(FakeIntersectionObserver.instances[1].disconnected).toBe(true);
  });

  it('shows every step and every finished visual when motion is reduced', async () => {
    media = makeMediaQuery(true);
    vi.stubGlobal('matchMedia', (() => media) as unknown as typeof matchMedia);

    render(<HowItWorks />);

    // No observers at all: nothing to watch, nothing to animate.
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
    for (let index = 0; index < 4; index += 1) {
      expect(opacityOf(index)).toBe('1');
    }
    await advance(100);
    expect(document.body.textContent).toContain(STEP_TYPE_TEXT);
    expect(document.body.textContent).toContain(STEP_THINK_LINES[2]);
    expect(document.body.textContent).toContain(STEP_WHY_TEXT);
    // Nothing is left waiting for a script that will never run.
    for (const element of document.querySelectorAll<HTMLElement>('[style]')) {
      expect(element.style.opacity).not.toBe('0');
    }
    expect(
      document
        .querySelector('[data-testid="sample-list-actions"]')
        ?.getAttribute('data-status'),
    ).toBe('open');
  });
});
