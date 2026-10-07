'use client';

import * as React from 'react';

/** How much of the element has to be visible before it reveals. */
export const REVEAL_THRESHOLD = 0.2;
/** How far the element travels, in CSS pixels. */
export const REVEAL_DISTANCE_PX = 14;
/** How long the reveal takes. */
export const REVEAL_DURATION_MS = 700;

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Reveal once.
 *
 * The server renders the element fully visible, so the page is complete without
 * JavaScript and nothing flashes. After hydration the element is only armed
 * hidden when it sits entirely below the fold, where the change cannot be seen,
 * and a single observer reveals it the first time 20 percent of it is visible.
 * The observer disconnects after that, so a reveal never runs twice and the
 * element never re-animates on the way back up.
 *
 * Reduced motion never arms anything: the element simply stays visible.
 */
export function useRevealOnce<T extends HTMLElement>(threshold: number = REVEAL_THRESHOLD) {
  const [node, setNode] = React.useState<T | null>(null);
  const [armed, setArmed] = React.useState(false);

  // A callback ref, so the element is held in state and no ref value is read
  // during render.
  const setRef = React.useCallback((value: T | null) => {
    setNode(value);
  }, []);

  React.useEffect(() => {
    if (!node) return;
    if (typeof window === 'undefined') return;
    if (prefersReducedMotion()) return;
    if (typeof IntersectionObserver !== 'function') return;

    // Arm only what is still out of sight, so nothing already painted moves.
    if (node.getBoundingClientRect().top < window.innerHeight) return;

    // Armed on the next frame, which still runs before it paints, so the armed
    // state is never in the server markup.
    const frame = window.requestAnimationFrame(() => {
      setArmed(true);
    });

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setArmed(false);
        observer.disconnect();
      },
      { threshold },
    );
    observer.observe(node);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [node, threshold]);

  return [setRef, armed] as const;
}

/** The style a revealed element carries: only the optional stagger delay. */
export function revealStyle(delayMs: number): React.CSSProperties {
  return { '--muse-reveal-delay': `${Math.max(0, Math.round(delayMs))}ms` } as React.CSSProperties;
}

/** Stagger for the capability rows, which reveal 40ms apart. */
export const CAPABILITY_STAGGER_MS = 40;
