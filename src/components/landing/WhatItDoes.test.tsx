import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatItDoes } from './WhatItDoes';
import { ROLLING_PHRASES } from '@/lib/landing-sample';
import {
  ROLL_DURATION_MS,
  ROLL_INTERVAL_MS,
  rollingPositionCount,
} from '@/lib/landing-rolling';
import { CAPABILITY_STAGGER_MS } from '@/hooks/use-reveal-once';

/**
 * The rolling word: one line tall window, a column with the first phrase
 * repeated at the end, a roll every 2.2 seconds, a silent jump back, a screen
 * reader sentence that carries every phrase, and a pause when the tab is hidden
 * or the section is offscreen.
 */

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  disconnected = false;
  observed: Element[] = [];
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }
  observe(element: Element) {
    this.observed.push(element);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  trigger(isIntersecting: boolean) {
    const element = this.observed[0];
    if (!element) return;
    this.callback(
      [{ target: element, isIntersecting } as IntersectionObserverEntry],
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

function column(): HTMLElement {
  return document.querySelector(
    '[data-testid="rolling-column"]',
  ) as HTMLElement;
}

function position(): number {
  return Number(column().getAttribute('data-position'));
}

function transform(): string {
  return column().style.transform;
}

function instant(): string | null {
  return column().getAttribute('data-instant');
}

describe('WhatItDoes', () => {
  beforeEach(() => {
    media = makeMediaQuery(false);
    FakeIntersectionObserver.instances = [];
    vi.useFakeTimers({
      toFake: [
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
        'requestAnimationFrame',
        'cancelAnimationFrame',
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

  it('renders the copy from the brief', () => {
    render(<WhatItDoes />);

    expect(screen.getByText('What it does')).toBeDefined();
    expect(
      screen.getByRole('heading', { name: 'Ask for anything. It listens.' }),
    ).toBeDefined();
    expect(screen.getByText('Try asking for')).toBeDefined();
    expect(document.getElementById('what-it-does')).not.toBeNull();
  });

  it('keeps the animated column decorative and lists every phrase for readers', () => {
    render(<WhatItDoes />);

    expect(column().getAttribute('aria-hidden')).toBe('true');
    // Six phrases plus the repeated first one, so the loop is seamless.
    expect(column().children).toHaveLength(
      rollingPositionCount(ROLLING_PHRASES.length),
    );
    expect(column().firstElementChild?.textContent).toBe(ROLLING_PHRASES[0]);
    expect(column().lastElementChild?.textContent).toBe(ROLLING_PHRASES[0]);

    const sentence = screen.getByText(
      `Try asking for: ${ROLLING_PHRASES.join(', ')}.`,
    );
    expect(sentence.className).toContain('sr-only');
    for (const phrase of ROLLING_PHRASES) {
      expect(sentence.textContent).toContain(phrase);
    }
  });

  it('rolls one phrase at a time, every 2.2 seconds', async () => {
    render(<WhatItDoes />);
    act(() => {
      FakeIntersectionObserver.instances[0].trigger(true);
    });

    expect(position()).toBe(0);
    expect(transform()).toBe('translate3d(0, 0em, 0)');

    await advance(ROLL_INTERVAL_MS - 1);
    expect(position()).toBe(0);

    await advance(1);
    expect(position()).toBe(1);
    expect(transform()).toBe('translate3d(0, -1em, 0)');
    expect(instant()).toBe('false');

    await advance(ROLL_INTERVAL_MS);
    expect(position()).toBe(2);
    expect(transform()).toBe('translate3d(0, -2em, 0)');
  });

  it('jumps back to the first phrase without a transition', async () => {
    render(<WhatItDoes />);
    act(() => {
      FakeIntersectionObserver.instances[0].trigger(true);
    });

    const count = ROLLING_PHRASES.length;
    await advance(ROLL_INTERVAL_MS * count);
    // The repeated phrase at the end of the column.
    expect(position()).toBe(count);

    await advance(ROLL_DURATION_MS);
    expect(position()).toBe(0);
    expect(instant()).toBe('true');

    // The transition comes back on before the next roll.
    act(() => {
      vi.advanceTimersByTime(0);
    });
    await advance(ROLL_INTERVAL_MS);
    expect(position()).toBe(1);
    expect(instant()).toBe('false');
  });

  it('pauses when the section leaves the viewport', async () => {
    render(<WhatItDoes />);
    const observer = FakeIntersectionObserver.instances[0];

    act(() => {
      observer.trigger(true);
    });
    await advance(ROLL_INTERVAL_MS);
    expect(position()).toBe(1);

    act(() => {
      observer.trigger(false);
    });
    await advance(ROLL_INTERVAL_MS * 4);
    expect(position()).toBe(1);

    act(() => {
      observer.trigger(true);
    });
    await advance(ROLL_INTERVAL_MS);
    expect(position()).toBe(2);
  });

  it('pauses while the tab is hidden', async () => {
    render(<WhatItDoes />);
    act(() => {
      FakeIntersectionObserver.instances[0].trigger(true);
    });
    await advance(ROLL_INTERVAL_MS);
    expect(position()).toBe(1);

    act(() => {
      Object.defineProperty(document, 'hidden', {
        value: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await advance(ROLL_INTERVAL_MS * 3);
    expect(position()).toBe(1);

    Object.defineProperty(document, 'hidden', {
      value: false,
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await advance(ROLL_INTERVAL_MS);
    expect(position()).toBe(2);
  });

  it('disconnects the observer on unmount', async () => {
    const view = render(<WhatItDoes />);
    act(() => {
      FakeIntersectionObserver.instances[0].trigger(true);
    });
    await advance(ROLL_INTERVAL_MS);
    view.unmount();

    expect(FakeIntersectionObserver.instances[0].disconnected).toBe(true);
  });

  it('lists the four capabilities with a 40ms stagger', () => {
    render(<WhatItDoes />);

    const rows = [
      'Natural language discovery',
      'Why this',
      'Open anywhere',
      'Your taste in words',
    ];
    for (const row of rows) {
      expect(screen.getByRole('heading', { name: row })).toBeDefined();
    }
    expect(
      screen.getByText(
        'Describe a moment and get real tracks, not a genre list.',
      ),
    ).toBeDefined();
    expect(
      screen.getByText(
        'A profile written from a Last.fm account or your Spotify data export, if you add one.',
      ),
    ).toBeDefined();

    const list = screen.getByRole('list');
    expect(list.className).toContain('muse-reveal');
    expect(CAPABILITY_STAGGER_MS).toBe(40);
    const items = [...list.querySelectorAll('li')];
    expect(items).toHaveLength(4);
    expect(items[0].style.getPropertyValue('--muse-reveal-delay')).toBe('0ms');
    expect(items[1].style.getPropertyValue('--muse-reveal-delay')).toBe('40ms');
    expect(items[3].style.getPropertyValue('--muse-reveal-delay')).toBe(
      '120ms',
    );
  });

  it('does not claim anything that is not built', () => {
    render(<WhatItDoes />);
    const text = document.body.textContent ?? '';

    for (const removed of [
      'Cross-platform sync',
      'Cross platform sync',
      'Intelligent music memory',
      'Deep genre exploration',
      'millions of tracks',
      'MUSE Intelligence',
    ]) {
      expect(text).not.toContain(removed);
    }
  });

  it('shows the first phrase only, and never rolls, when motion is reduced', async () => {
    media = makeMediaQuery(true);
    vi.stubGlobal('matchMedia', (() => media) as unknown as typeof matchMedia);

    render(<WhatItDoes />);

    expect(FakeIntersectionObserver.instances).toHaveLength(0);
    expect(position()).toBe(0);
    expect(transform()).toBe('translate3d(0, 0em, 0)');

    await advance(ROLL_INTERVAL_MS * 5);
    expect(position()).toBe(0);
  });
});
