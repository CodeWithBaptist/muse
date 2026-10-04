import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HowItWorks, Features, Footer } from './LandingSections';

// The sections use Motion for their reveals; these checks only care about
// markup and observers, so Motion renders plain elements.
vi.mock('motion/react', async () => {
  const { motionMock } = await import('@/test/motion-mock');
  return motionMock;
});

/**
 * Section behaviour: the numbered steps reveal once and the current step
 * brightens, the mark card pulses once when it enters view, and the footer
 * stays static.
 */

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  observed: Element[] = [];
  disconnected = false;
  disconnectCalls = 0;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target: Element) {
    this.observed.push(target);
  }

  unobserve() {}

  disconnect() {
    this.disconnected = true;
    this.disconnectCalls += 1;
  }

  trigger(entries: Array<{ target: Element; isIntersecting: boolean }>) {
    this.callback(
      entries.map((entry) => ({ ...entry })) as unknown as IntersectionObserverEntry[],
      this as unknown as IntersectionObserver,
    );
  }
}

function steps(): HTMLElement[] {
  return [...document.querySelectorAll('[data-step]')] as HTMLElement[];
}

describe('HowItWorks', () => {
  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal(
      'IntersectionObserver',
      FakeIntersectionObserver as unknown as typeof IntersectionObserver,
    );
    vi.stubGlobal(
      'matchMedia',
      (() => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
      })) as unknown as typeof matchMedia,
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('reveals each step as it enters the viewport, once', () => {
    render(<HowItWorks />);

    const nodes = steps();
    expect(nodes).toHaveLength(4);
    // The step observer has the ring band observer alongside it.
    expect(FakeIntersectionObserver.instances.length).toBe(2);

    const reveal = FakeIntersectionObserver.instances[0];
    act(() => {
      reveal.trigger([{ target: nodes[0], isIntersecting: true }]);
    });
    expect(nodes[0].getAttribute('data-revealed')).toBe('true');
    expect(nodes[1].getAttribute('data-revealed')).toBe('false');
    expect(nodes[0].className).toContain('translate-y-0');
    expect(nodes[1].className).toContain('translate-y-3');
    // The stagger is a CSS custom property, so it never touches layout.
    expect(nodes[2].style.getPropertyValue('--muse-step-delay')).toBe('180ms');

    act(() => {
      reveal.trigger([{ target: nodes[0], isIntersecting: false }]);
    });
    expect(nodes[0].getAttribute('data-revealed')).toBe('true');
  });

  it('brightens the current step and leaves the others quiet', () => {
    render(<HowItWorks />);
    const nodes = steps();
    const current = FakeIntersectionObserver.instances[1];
    expect(current.options?.rootMargin).toContain('-45%');

    act(() => {
      current.trigger([{ target: nodes[2], isIntersecting: true }]);
    });
    expect(nodes[2].getAttribute('data-current')).toBe('true');
    expect(nodes[2].querySelector('h3')?.className).toContain('text-text-primary');
    expect(nodes[0].querySelector('h3')?.className).toContain('text-text-secondary');

    act(() => {
      current.trigger([
        { target: nodes[2], isIntersecting: false },
        { target: nodes[3], isIntersecting: true },
      ]);
    });
    expect(nodes[3].getAttribute('data-current')).toBe('true');
    expect(nodes[2].getAttribute('data-current')).toBe('false');
  });

  it('keeps the anchor target and the extra scroll space for a sticky header', () => {
    render(<HowItWorks />);
    const section = document.getElementById('how-it-works');
    expect(section).not.toBeNull();
    expect(section?.className).toContain('scroll-mt-24');
  });

  it('cleans both observers up on unmount', () => {
    const { unmount } = render(<HowItWorks />);
    const [reveal, current] = FakeIntersectionObserver.instances;
    unmount();
    expect(reveal.disconnected).toBe(true);
    expect(current.disconnected).toBe(true);
  });
});

describe('Features', () => {
  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal(
      'IntersectionObserver',
      FakeIntersectionObserver as unknown as typeof IntersectionObserver,
    );
    vi.stubGlobal(
      'matchMedia',
      (() => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
      })) as unknown as typeof matchMedia,
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('keeps the copy and the mark card, and pulses the mark once', () => {
    render(<Features />);

    expect(
      screen.getByRole('heading', { name: /designed for the modern listener/i }),
    ).toBeDefined();
    expect(screen.getByText('MUSE Intelligence')).toBeDefined();
    expect(screen.getByRole('img', { name: 'muse' })).toBeDefined();

    const observer = FakeIntersectionObserver.instances[0];
    expect(observer).toBeDefined();
    act(() => {
      observer.trigger([{ target: document.body, isIntersecting: true }]);
    });
    expect(document.querySelector('.muse-cta-pulse')).not.toBeNull();
    // The pulse runs once and then rests: the observer is done after firing.
    expect(observer.disconnected).toBe(true);
  });

  it('does not pulse when motion is reduced', () => {
    vi.stubGlobal(
      'matchMedia',
      (() => ({
        matches: true,
        addEventListener() {},
        removeEventListener() {},
      })) as unknown as typeof matchMedia,
    );

    render(<Features />);
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
    expect(document.querySelector('.muse-cta-pulse')).toBeNull();
  });
});

describe('Footer', () => {
  it('renders the links and no animation hooks', () => {
    const { container } = render(<Footer />);

    expect(container.querySelectorAll('a').length).toBe(3);
    expect(container.querySelectorAll('[class*="muse-"]').length).toBe(0);
    expect(container.querySelectorAll('[data-]').length).toBe(0);
    expect(screen.getByText(/© 2026 MUSE/)).toBeDefined();
  });
});
