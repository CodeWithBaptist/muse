import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LANDING_NAV, SiteHeader } from './SiteHeader';
import {
  landingNavClickHandler,
  prefersReducedMotion,
} from '@/lib/landing-scroll';
import { HERO_DOT_PULSE_SCALE } from '@/lib/hero-entrance';

vi.mock('motion/react', async () => {
  const { motionMock } = await import('@/test/motion-mock');
  return motionMock;
});

/**
 * The header: solid with a hairline and no blur, a mark whose accent dot pulses on
 * the shared beat, nav links that drop out under 760px and smooth scroll only
 * when motion is allowed, and the shared primary action.
 */

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
      options?.signal?.addEventListener('abort', () =>
        listeners.delete(listener),
      );
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
    listenerCount: () => listeners.size,
  };
}

let media = makeMediaQuery(false);
let frameQueue = new Map<number, (time: number) => void>();
let nextHandle = 0;

function stepTo(time: number) {
  const pending = [...frameQueue.values()];
  frameQueue.clear();
  act(() => {
    for (const callback of pending) callback(time);
  });
}

describe('SiteHeader', () => {
  beforeEach(() => {
    media = makeMediaQuery(false);
    frameQueue = new Map();
    nextHandle = 0;
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
    vi.stubGlobal('matchMedia', (() => media) as unknown as typeof matchMedia);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('is sticky and solid, with a hairline and no blur', () => {
    const { container } = render(<SiteHeader />);
    const header = container.querySelector('header') as HTMLElement;

    expect(header.className).toContain('sticky top-0');
    expect(header.className).toContain('bg-background');
    expect(header.className).toContain('border-b border-border-subtle');
    expect(header.className).not.toContain('backdrop-');
    expect(header.className).not.toContain('blur');
  });

  it('carries the mark with the accent dot on the left', () => {
    render(<SiteHeader />);

    expect(screen.getByRole('img', { name: 'muse' })).toBeDefined();
    expect(
      document.querySelector('[data-testid="landing-mark-dot"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-piece="dot"]')).not.toBeNull();
  });

  it('pulses the mark dot on the shared beat', () => {
    render(<SiteHeader />);
    const dot = document.querySelector(
      '[data-testid="landing-mark-dot"]',
    ) as HTMLElement;

    stepTo(0);
    const onBeat = Number.parseFloat(
      dot.style.transform.replace('scale(', '').replace(')', ''),
    );
    expect(onBeat).toBeCloseTo(1 + HERO_DOT_PULSE_SCALE, 3);

    stepTo(624);
    const offBeat = Number.parseFloat(
      dot.style.transform.replace('scale(', '').replace(')', ''),
    );
    expect(offBeat).toBeLessThan(onBeat);
    expect(offBeat).toBeGreaterThan(1);
  });

  it('never pulses the dot when motion is reduced', () => {
    media = makeMediaQuery(true);
    vi.stubGlobal('matchMedia', (() => media) as unknown as typeof matchMedia);

    render(<SiteHeader />);
    const dot = document.querySelector(
      '[data-testid="landing-mark-dot"]',
    ) as HTMLElement;

    stepTo(0);
    expect(dot.style.transform).toBe('');
    expect(frameQueue.size).toBe(0);
  });

  it('links the three sections and hides the links under 760px', () => {
    render(<SiteHeader />);
    const nav = screen.getByRole('navigation', { name: 'Landing' });

    expect(LANDING_NAV.map((item) => item.label)).toEqual([
      'See it work',
      'How it works',
      'What it does',
    ]);
    expect(nav.className).toContain('hidden');
    expect(nav.className).toContain('min-[760px]:flex');

    for (const item of LANDING_NAV) {
      const link = screen.getByRole('link', { name: item.label });
      expect(link.getAttribute('href')).toBe(`#${item.id}`);
    }
  });

  it('keeps the primary action on the right, as a link into the chat, next to display settings', () => {
    render(<SiteHeader />);
    const start = screen.getByRole('link', { name: 'Start' });
    expect(start.getAttribute('href')).toBe('/chat');
    expect(start.className).toContain('h-9');
    expect(
      screen.getByRole('button', { name: 'Display settings' }),
    ).toBeInTheDocument();
  });

  it('smooth scrolls only when motion is allowed', () => {
    const target = document.createElement('div');
    target.id = 'how-it-works';
    document.body.appendChild(target);
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;

    const anchor = document.createElement('a');
    const handler = landingNavClickHandler('how-it-works');

    const prevented = vi.fn();
    const click = (extra: Partial<React.MouseEvent<HTMLAnchorElement>> = {}) =>
      handler({
        target: anchor,
        currentTarget: anchor,
        defaultPrevented: false,
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        preventDefault: prevented,
        ...extra,
      } as unknown as React.MouseEvent<HTMLAnchorElement>);

    click();

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });

    media = makeMediaQuery(true);
    vi.stubGlobal('matchMedia', (() => media) as unknown as typeof matchMedia);
    expect(prefersReducedMotion()).toBe(true);
    click();
    expect(scrollIntoView).toHaveBeenLastCalledWith({
      behavior: 'auto',
      block: 'start',
    });
    // The smooth scroll replaced the anchor jump, so the default was cancelled.
    expect(prevented).toHaveBeenCalledTimes(2);

    target.remove();
  });

  it('leaves the anchor alone for a modified or non primary click', () => {
    const target = document.createElement('div');
    target.id = 'what-it-does';
    document.body.appendChild(target);
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;

    const anchor = document.createElement('a');
    const handler = landingNavClickHandler('what-it-does');

    handler({
      target: anchor,
      currentTarget: anchor,
      defaultPrevented: false,
      button: 1,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: () => {},
    } as unknown as React.MouseEvent<HTMLAnchorElement>);
    expect(scrollIntoView).not.toHaveBeenCalled();

    handler({
      target: anchor,
      currentTarget: anchor,
      defaultPrevented: false,
      button: 0,
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: () => {},
    } as unknown as React.MouseEvent<HTMLAnchorElement>);
    expect(scrollIntoView).not.toHaveBeenCalled();

    target.remove();
  });

  it('returns false when the target section is missing', () => {
    const anchor = document.createElement('a');
    let prevented = false;
    landingNavClickHandler('not-on-the-page')({
      target: anchor,
      currentTarget: anchor,
      defaultPrevented: false,
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: () => {
        prevented = true;
      },
    } as unknown as React.MouseEvent<HTMLAnchorElement>);

    // The anchor keeps working as a plain link.
    expect(prevented).toBe(false);
  });
});
