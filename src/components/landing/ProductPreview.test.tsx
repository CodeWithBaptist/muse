import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductPreview } from './ProductPreview';
import { LANDING_SAMPLE } from '@/lib/landing-sample';
import {
  PREVIEW_THINKING_LINE_MS,
  previewTimeline,
} from '@/lib/landing-preview';

/**
 * The scripted demo in the DOM: the server paints the finished frame, the
 * window is armed as soon as any of it is visible, one intersection past 40
 * percent starts the sequence, the real components walk through their states,
 * Replay starts it over, and reduced motion keeps the finished frame.
 */

const timeline = previewTimeline(LANDING_SAMPLE);

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

let media = makeMediaQuery(false);

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

function phase(): string | null {
  return (
    document
      .querySelector('[data-preview-phase]')
      ?.getAttribute('data-preview-phase') ?? null
  );
}

function input(): HTMLInputElement | null {
  return document.querySelector('[data-testid="sample-input"]');
}

/** The arm observer (any part visible), then the start observer (40 percent). */
function arm() {
  act(() => {
    FakeIntersectionObserver.instances[0].trigger(true);
  });
}

function start() {
  act(() => {
    FakeIntersectionObserver.instances[1].trigger(true);
  });
}

function leave() {
  act(() => {
    FakeIntersectionObserver.instances[1].trigger(false);
  });
}

describe('ProductPreview', () => {
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
        'Date',
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

  it('renders the finished sample frame on the first paint, with no animation', () => {
    render(<ProductPreview />);

    expect(phase()).toBe('playing');
    expect(screen.getByText('Sample')).toBeDefined();
    // The sample ids are not Spotify ids, so no row renders a link.
    expect(screen.queryByTestId('track-row-open-in-spotify')).toBeNull();
    expect(
      document.querySelector('[data-testid="create-in-spotify-primary"]'),
    ).not.toBeNull();
  });

  it('never looks empty: the hint and the placeholder are there before it starts', () => {
    render(<ProductPreview />);

    expect(document.body.textContent).toContain(LANDING_SAMPLE.hint);
    expect(input()).not.toBeNull();
    expect(input()?.getAttribute('placeholder')).toBe(
      LANDING_SAMPLE.inputPlaceholder,
    );
    // The input is decorative: read only, out of the tab order, and inert.
    expect(input()?.readOnly).toBe(true);
    expect(input()?.getAttribute('tabindex')).toBe('-1');
    expect(input()?.closest('[inert]')).not.toBeNull();
  });

  it('plays the sequence once when the window is 40 percent visible', async () => {
    render(<ProductPreview />);
    expect(FakeIntersectionObserver.instances).toHaveLength(2);

    arm();
    expect(phase()).toBe('typing');
    start();
    // The start observer stays on: the preview pauses when it leaves the view.
    expect(FakeIntersectionObserver.instances[1].disconnected).toBe(false);

    // Typing: the prompt arrives about 42ms per character, in the input. The
    // timeline is sampled every 40ms, so the exact character count is the last
    // sample that has run.
    await advance(420);
    const typed = input()?.value ?? '';
    expect(typed).toBe(LANDING_SAMPLE.prompt.slice(0, 9));
    expect(typed).not.toBe(LANDING_SAMPLE.prompt);

    await advance(LANDING_SAMPLE.prompt.length * 42);
    expect(phase()).toBe('thinking');
    // The text has left the input and joined the thread.
    expect(input()?.value).toBe('');
    expect(document.body.textContent).toContain(LANDING_SAMPLE.thinkingLines[0]);

    await advance(PREVIEW_THINKING_LINE_MS);
    expect(document.body.textContent).toContain(LANDING_SAMPLE.thinkingLines[1]);

    await advance(
      timeline.thinkingEnd -
        LANDING_SAMPLE.prompt.length * 42 -
        420 -
        PREVIEW_THINKING_LINE_MS +
        200,
    );
    expect(phase()).toBe('replying');

    // Rows rise, the create control runs, and the first row starts playing.
    await advance(timeline.totalMs - timeline.replyEnd + 1200);
    expect(phase()).toBe('playing');
    expect(document.body.textContent).toContain('Playlist created.');
    expect(document.body.textContent).toContain('Open in Spotify');

    // The sequence stops on its own: time passing changes nothing.
    await advance(5000);
    expect(phase()).toBe('playing');
  });

  it('labels the sample window and keeps the reply selectable', () => {
    render(<ProductPreview />);

    expect(document.body.textContent).toContain('Late Night Lagos');
    expect(document.body.textContent).toContain('3 tracks');
    expect(
      document.body.textContent?.includes('Nothing here contacts Spotify or OpenAI'),
    ).toBe(true);

    const conversation = document.querySelector('[inert]');
    expect(conversation).not.toBeNull();
    expect(conversation?.className).not.toContain('select-none');
  });

  it('walks the real create control through creating, created, then open', async () => {
    render(<ProductPreview />);
    arm();
    start();

    let elapsed = 0;
    const advanceTo = async (target: number) => {
      await advance(target - elapsed);
      elapsed = target;
    };

    await advanceTo(timeline.rowsEnd + 40);
    expect(phase()).toBe('rows');
    expect(document.body.textContent).toContain('Create in Spotify');

    await advanceTo(timeline.rowsEnd + 600);
    expect(phase()).toBe('creating');
    expect(document.body.textContent).toContain('Creating this in Spotify');

    await advanceTo(timeline.creatingEnd + 40);
    expect(phase()).toBe('created');
    expect(document.body.textContent).toContain('Playlist created.');

    await advanceTo(timeline.createdEnd + 40);
    expect(phase()).toBe('open');
    expect(document.body.textContent).toContain('Open in Spotify');

    // Every control in the sample is inert and hidden from assistive tech. The
    // newest layer of the control is the open state, which renders a span: the
    // sample can never produce a link that leaves the page.
    const inert = document.querySelector('[inert]');
    expect(inert).not.toBeNull();
    expect(inert?.getAttribute('aria-hidden')).toBe('true');

    const primaries = [
      ...document.querySelectorAll('[data-testid="create-in-spotify-primary"]'),
    ];
    const newest = primaries[primaries.length - 1];
    expect(newest.tagName).toBe('SPAN');
    expect(
      document
        .querySelector('[data-testid="create-in-spotify"]')
        ?.getAttribute('data-status'),
    ).toBe('open');
    expect(
      document.querySelector('a[href^="https://open.spotify.com"]'),
    ).toBeNull();
  });

  it('plays the first row last, with a live equalizer instead of a number', async () => {
    render(<ProductPreview />);
    arm();
    start();

    await advance(timeline.createdEnd + 60);
    expect(phase()).toBe('open');
    expect(
      screen.queryByRole('img', { name: /now playing/i, hidden: true }),
    ).toBeNull();

    await advance(timeline.totalMs - timeline.createdEnd + 100);
    expect(phase()).toBe('playing');
    expect(
      screen.getByRole('img', {
        name: `Now playing ${LANDING_SAMPLE.tracks[0].name}`,
        hidden: true,
      }),
    ).toBeDefined();
  });

  it('waits below the fold, plays at 40 percent, and pauses offscreen', async () => {
    render(<ProductPreview />);

    // Still below the fold: nothing has started, the finished frame is showing.
    act(() => {
      FakeIntersectionObserver.instances[0].trigger(false);
      FakeIntersectionObserver.instances[1].trigger(false);
    });
    await advance(3000);
    expect(phase()).toBe('playing');

    arm();
    expect(phase()).toBe('typing');
    start();

    await advance(600);
    expect(phase()).toBe('typing');

    // Leaving the viewport pauses the sequence: no progress while away.
    leave();
    await advance(4000);
    expect(phase()).toBe('typing');

    // Coming back resumes it, and it still finishes on its own.
    start();
    await advance(timeline.totalMs + 400);
    expect(phase()).toBe('playing');

    await advance(5000);
    expect(phase()).toBe('playing');
  });

  it('pauses while the tab is hidden', async () => {
    render(<ProductPreview />);
    arm();
    start();
    await advance(600);

    act(() => {
      Object.defineProperty(document, 'hidden', {
        value: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await advance(3000);
    expect(phase()).toBe('typing');

    Object.defineProperty(document, 'hidden', {
      value: false,
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await advance(timeline.totalMs + 400);
    expect(phase()).toBe('playing');
  });

  it('replays from the start when Replay is pressed', async () => {
    render(<ProductPreview />);
    arm();
    start();
    await advance(timeline.totalMs + 200);
    expect(phase()).toBe('playing');

    act(() => {
      screen.getByRole('button', { name: 'Replay' }).click();
    });
    expect(phase()).toBe('typing');

    await advance(timeline.totalMs + 200);
    expect(phase()).toBe('playing');
  });

  it('cleans up every observer and timer on unmount', async () => {
    const view = render(<ProductPreview />);
    arm();
    start();
    await advance(400);

    view.unmount();

    expect(FakeIntersectionObserver.instances[0].disconnected).toBe(true);
    expect(FakeIntersectionObserver.instances[1].disconnected).toBe(true);
    await advance(timeline.totalMs);
    expect(document.querySelector('[data-preview-phase]')).toBeNull();
  });

  it('keeps the finished frame and does not animate when motion is reduced', async () => {
    media = makeMediaQuery(true);
    vi.stubGlobal('matchMedia', (() => media) as unknown as typeof matchMedia);

    render(
      <React.StrictMode>
        <ProductPreview />
      </React.StrictMode>,
    );

    expect(FakeIntersectionObserver.instances).toHaveLength(0);
    expect(phase()).toBe('playing');

    // Even if something tried to start it, the finished frame stays put.
    act(() => {
      screen.getByRole('button', { name: 'Replay' }).click();
    });
    await advance(2000);
    expect(phase()).toBe('playing');
  });
});
