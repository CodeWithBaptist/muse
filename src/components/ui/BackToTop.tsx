'use client';

import * as React from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { prefersReducedMotion } from '@/lib/landing-scroll';

/**
 * A floating back to top control.
 *
 * The footer link is the no-JavaScript way up; this button is the one that is
 * already in reach while reading. It stays out of the way (and out of the tab
 * order) until the page or its scroll container has actually been scrolled,
 * then fades in bottom right. The click scrolls smoothly, or jumps straight
 * up when the visitor has asked for reduced motion.
 *
 * With no `scrollerRef` it watches the window, which is what the landing page
 * needs. Pass a ref to watch one scroll container instead (the app shell, the
 * chat log). The scroll listener sits on the window in the capture phase, so
 * nested scrollers report too, and the container is read at event time, so a
 * container that remounts on route change is picked up without re-subscribing.
 */
export interface BackToTopProps {
  /** Scroll container to watch and scroll. Defaults to the window. */
  scrollerRef?: React.RefObject<HTMLElement | null>;
  /** Pixels scrolled before the control appears. */
  threshold?: number;
  className?: string;
}

/** Sends a container back to its top; plain assignment where scrollTo is absent. */
function scrollContainerToTop(element: HTMLElement, behavior: ScrollBehavior) {
  if (typeof element.scrollTo === 'function') {
    element.scrollTo({ top: 0, behavior });
  } else {
    element.scrollTop = 0;
  }
}

export function BackToTop({
  scrollerRef,
  threshold = 480,
  className,
}: BackToTopProps) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const readScrollTop = () => {
      const scroller = scrollerRef?.current;
      return scroller ? scroller.scrollTop : window.scrollY;
    };
    const onScroll = () => {
      setVisible(readScrollTop() > threshold);
    };
    // Capture phase on the window hears every scroller in the document,
    // including ones nested inside the page (the chat log, for example).
    window.addEventListener('scroll', onScroll, {
      passive: true,
      capture: true,
    });
    window.addEventListener('resize', onScroll);
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
    };
  }, [scrollerRef, threshold]);

  const scrollToTop = () => {
    const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
    const scroller = scrollerRef?.current;
    if (scroller) {
      scrollContainerToTop(scroller, behavior);
    } else {
      window.scrollTo({ top: 0, behavior });
    }
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      data-testid="back-to-top-floating"
      data-visible={visible}
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center rounded-full border border-border-strong bg-surface text-text-primary shadow-lg transition-[opacity,transform] duration-300 focus-ring',
        visible
          ? 'opacity-100 translate-y-0'
          : 'pointer-events-none opacity-0 translate-y-2',
        className,
      )}
    >
      <ArrowUp className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
