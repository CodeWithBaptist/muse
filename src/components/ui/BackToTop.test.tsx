import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { BackToTop } from './BackToTop';

/**
 * The floating back to top control. It stays hidden (and out of the tab
 * order) until its scroll container has actually been scrolled, then fades
 * in; one click sends that container back to the top, smoothly unless the
 * visitor has asked for reduced motion.
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

function setWindowScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', {
    value,
    configurable: true,
    writable: true,
  });
}

/** Fires a real scroll event, the way the browser does when a page scrolls. */
function fireScroll(target: EventTarget = window) {
  act(() => {
    target.dispatchEvent(new Event('scroll'));
  });
}

describe('BackToTop', () => {
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
    setWindowScrollY(0);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('stays hidden and out of the tab order until the page is scrolled', () => {
    render(<BackToTop />);

    const button = screen.getByTestId('back-to-top-floating');
    expect(button.getAttribute('aria-hidden')).toBe('true');
    expect(button.getAttribute('tabindex')).toBe('-1');
    expect(button.className).toContain('opacity-0');
    expect(button.className).toContain('pointer-events-none');

    setWindowScrollY(600);
    fireScroll();

    expect(button.getAttribute('aria-hidden')).toBe('false');
    expect(button.getAttribute('tabindex')).toBe('0');
    expect(button.className).toContain('opacity-100');

    // Scrolling back up hides it again.
    setWindowScrollY(0);
    fireScroll();
    expect(button.getAttribute('aria-hidden')).toBe('true');
    expect(button.getAttribute('tabindex')).toBe('-1');
  });

  it('does not appear for a small scroll under the threshold', () => {
    render(<BackToTop threshold={480} />);

    setWindowScrollY(200);
    fireScroll();

    const button = screen.getByTestId('back-to-top-floating');
    expect(button.getAttribute('aria-hidden')).toBe('true');
  });

  it('scrolls the window back to the top, smoothly', () => {
    render(<BackToTop />);

    setWindowScrollY(900);
    fireScroll();
    screen.getByTestId('back-to-top-floating').click();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('jumps instead of scrolling when motion is reduced', () => {
    media = makeMediaQuery(true);
    render(<BackToTop />);

    setWindowScrollY(900);
    fireScroll();
    screen.getByTestId('back-to-top-floating').click();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('watches a scroll container instead of the window when given one', () => {
    const scrollerRef = React.createRef<HTMLDivElement>();
    render(
      <div ref={scrollerRef} data-testid="scroller">
        <BackToTop scrollerRef={scrollerRef} />
      </div>,
    );

    const button = screen.getByTestId('back-to-top-floating');
    const scroller = screen.getByTestId('scroller');

    // The window being scrolled does not move a container control.
    setWindowScrollY(900);
    fireScroll();
    expect(button.getAttribute('aria-hidden')).toBe('true');

    // The container scrolling does, even though the event never bubbles.
    Object.defineProperty(scroller, 'scrollTop', {
      value: 700,
      configurable: true,
      writable: true,
    });
    fireScroll(scroller);
    expect(button.getAttribute('aria-hidden')).toBe('false');

    // And the click sends the container, not the window, back to the top.
    const elementScrollTo = vi.fn();
    Object.defineProperty(scroller, 'scrollTo', {
      value: elementScrollTo,
      configurable: true,
      writable: true,
    });
    button.click();
    expect(elementScrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('falls back to assigning scrollTop where scrollTo is unavailable', () => {
    const scrollerRef = React.createRef<HTMLDivElement>();
    render(
      <div ref={scrollerRef} data-testid="scroller">
        <BackToTop scrollerRef={scrollerRef} />
      </div>,
    );

    const scroller = screen.getByTestId('scroller');
    Object.defineProperty(scroller, 'scrollTop', {
      value: 700,
      configurable: true,
      writable: true,
    });
    fireScroll(scroller);

    // jsdom has no Element.scrollTo; the control still gets the container up.
    screen.getByTestId('back-to-top-floating').click();
    expect(scroller.scrollTop).toBe(0);
  });
});
