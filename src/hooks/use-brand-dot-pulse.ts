'use client';

import * as React from 'react';
import { beatEnvelope, subscribeBeat } from '@/lib/beat-clock';

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Pulses the accent dot of a landing mark on the shared beat.
 *
 * It joins the one requestAnimationFrame loop instead of starting its own, and
 * it clears the transform on the way out so the element is left exactly as it
 * was rendered. Under reduced motion it never subscribes and never writes a
 * transform, so the dot simply sits still.
 */
export function useBrandDotPulse(
  ref: React.RefObject<HTMLElement | null>,
  pulseScale: number,
): void {
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (prefersReducedMotion()) return;

    const unsubscribe = subscribeBeat((nowMs) => {
      const scale = 1 + pulseScale * beatEnvelope(nowMs);
      node.style.transform = `scale(${scale.toFixed(4)})`;
    });

    return () => {
      unsubscribe();
      node.style.transform = '';
    };
  }, [ref, pulseScale]);
}
