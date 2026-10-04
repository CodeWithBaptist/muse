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
 * The scripted preview in the DOM: the first paint is the finished frame, one
 * intersection starts the sequence, the real components walk through their
 * states, Replay starts it over, and reduced motion keeps the finished frame.
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
  return document
    .querySelector('[data-preview-phase]')
    ?.getAttribute('data-preview-phase') ?? null;
}

function progress(ms: number) {
  return advance(ms);
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

    expect(phase()).toBe('open');
    expect(screen.getByText('Sample')).toBeDefined();
    // The sample ids are not Spotify ids, so no row renders a link.
    expect(screen.queryByTestId('track-row-open-in-spotify')).toBeNull();
    expect(document.querySelector('[data-testid="create-in-spotify-primary"]'))
      .not.toBeNull();
  });

  it('plays the sequence once when the preview is 40 percent visible', async () => {
    render(<ProductPreview />);
    expect(FakeIntersectionObserver.instances).toHaveLength(1);

    act(() => {
      FakeIntersectionObserver.instances[0].trigger(true);
    });
    expect(FakeIntersectionObserver.instances[0].disconnected).toBe(true);
    expect(phase()).toBe('typing');

    // Typing: the prompt arrives about 42ms per character.
    const typedTarget = LANDING_SAMPLE.prompt.length * 42;
    await progress(420);
    const typedText = document.body.textContent ?? '';
    // About 42ms per character: a partial prompt, never the whole thing yet.
    expect(typedText).toContain(LANDING_SAMPLE.prompt.slice(0, 8));
    expect(typedText).not.toContain(LANDING_SAMPLE.prompt);

    await progress(typedTarget);
    expect(phase()).toBe('thinking');
    expect(document.body.textContent).toContain(
      LANDING_SAMPLE.thinkingLines[0],
    );

    await progress(PREVIEW_THINKING_LINE_MS);
    expect(document.body.textContent).toContain(
      LANDING_SAMPLE.thinkingLines[1],
    );

    // Replying: the first words of the reply fade in.
    await progress(
      timeline.thinkingEnd - typedTarget - 420 - PREVIEW_THINKING_LINE_MS + 200,
    );
    expect(phase()).toBe('replying');

    // Rows then rise, the create control runs, and the control ends open.
    // Advancing past the end is safe: the sequence holds its finished frame.
    await progress(timeline.totalMs - timeline.replyEnd + 1200);
    expect(phase()).toBe('open');
    expect(document.body.textContent).toContain('Playlist created.');
    expect(document.body.textContent).toContain('Open in Spotify');

    // The sequence stops on its own: time passing changes nothing.
    await progress(5000);
    expect(phase()).toBe('open');
  });

  it('walks the real create control through creating, created, then open', async () => {
    render(<ProductPreview />);
    act(() => {
      FakeIntersectionObserver.instances[0].trigger(true);
    });
    await progress(timeline.rowsEnd + 1);
    expect(phase()).toBe('rows');
    expect(document.body.textContent).toContain('Create in Spotify');

    await progress(600);
    expect(phase()).toBe('creating');
    expect(document.body.textContent).toContain('Creating this in Spotify');

    await progress(timeline.creatingEnd - timeline.rowsEnd);
    expect(phase()).toBe('created');
    expect(document.body.textContent).toContain('Playlist created.');

    await progress(timeline.createdEnd - timeline.creatingEnd);
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
      document.querySelector('[data-testid="create-in-spotify"]')?.getAttribute(
        'data-status',
      ),
    ).toBe('open');
    expect(document.querySelector('a[href^="https://open.spotify.com"]')).toBeNull();
  });

  it('pauses while offscreen and never loops on its own', async () => {
    render(<ProductPreview />);
    act(() => {
      FakeIntersectionObserver.instances[0].trigger(true);
    });
    await progress(600);
    const beforePause = phase();

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await progress(2000);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await progress(timeline.totalMs + 200);
    expect(phase()).toBe('open');
    expect(beforePause).toBe('typing');
  });

  it('replays from the start when Replay is pressed', async () => {
    render(<ProductPreview />);
    act(() => {
      FakeIntersectionObserver.instances[0].trigger(true);
    });
    await progress(timeline.totalMs + 200);
    expect(phase()).toBe('open');

    act(() => {
      screen.getByRole('button', { name: 'Replay' }).click();
    });
    expect(phase()).toBe('typing');

    await progress(timeline.totalMs + 200);
    expect(phase()).toBe('open');
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
    expect(phase()).toBe('open');

    // Even if something tried to start it, the finished frame stays put.
    act(() => {
      screen.getByRole('button', { name: 'Replay' }).click();
    });
    await progress(2000);
    expect(phase()).toBe('open');
  });
});
