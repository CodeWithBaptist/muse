import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteFooter } from './SiteFooter';
import { LANDING_TOP_FRAGMENT } from '@/lib/landing-scroll';

/**
 * The footer sends the visitor back to the top twice over: through the mark,
 * and through a small control beside the copyright. Both are real anchors on
 * the `#top` fragment, so they still work with no JavaScript, and the handler
 * only upgrades the jump to a smooth scroll when motion is allowed.
 */

function makeMediaQuery(matches: boolean) {
  return {
    matches,
    media: '',
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

let media = makeMediaQuery(false);

/** Clicks an anchor for real, so the handler runs the way it does in a browser. */
function click(element: Element, init: MouseEventInit = {}) {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...init,
  });
  act(() => {
    element.dispatchEvent(event);
  });
  return event;
}

describe('SiteFooter', () => {
  let scrollTo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    media = makeMediaQuery(false);
    scrollTo = vi.fn();
    vi.stubGlobal('matchMedia', (() => media) as unknown as typeof matchMedia);
    Object.defineProperty(window, 'scrollTo', {
      value: scrollTo,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('makes the mark a link back to the top of the page', () => {
    render(<SiteFooter />);

    const mark = screen.getByRole('link', { name: 'MUSE, back to the top' });
    expect(mark.getAttribute('href')).toBe(LANDING_TOP_FRAGMENT);
    expect(mark.textContent).toBe('MUSE');

    const event = click(mark);

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    // The smooth scroll replaced the jump, so the default was cancelled.
    expect(event.defaultPrevented).toBe(true);
  });

  it('adds a small back to top control next to the copyright', () => {
    render(<SiteFooter />);

    const link = screen.getByTestId('back-to-top');
    expect(link.getAttribute('href')).toBe(LANDING_TOP_FRAGMENT);
    expect(link.textContent).toContain('Back to top');

    // Small on purpose: a 12px arrow in caption type, with no box around it.
    const icon = link.querySelector('svg');
    expect(icon?.getAttribute('width')).toBe('12');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(link.className).toContain('type-caption');
    expect(link.className).not.toContain('bg-');
    expect(link.className).not.toContain('border');

    const event = click(link);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(event.defaultPrevented).toBe(true);
  });

  it('jumps instead of scrolling when motion is reduced', () => {
    media = makeMediaQuery(true);
    vi.stubGlobal('matchMedia', (() => media) as unknown as typeof matchMedia);

    render(<SiteFooter />);
    click(screen.getByTestId('back-to-top'));

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('leaves the anchor alone for a modified or non primary click', () => {
    render(<SiteFooter />);
    const link = screen.getByTestId('back-to-top');

    const middle = click(link, { button: 1 });
    expect(scrollTo).not.toHaveBeenCalled();
    expect(middle.defaultPrevented).toBe(false);

    const modified = click(link, { metaKey: true });
    expect(scrollTo).not.toHaveBeenCalled();
    expect(modified.defaultPrevented).toBe(false);
  });

  it('still links the three real pages', () => {
    render(<SiteFooter />);

    expect(screen.getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe(
      '/privacy',
    );
    expect(screen.getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe(
      '/terms',
    );
    expect(
      screen.getByRole('link', { name: 'Spotify attribution' }).getAttribute('href'),
    ).toBe('/spotify-attribution');
  });
});
