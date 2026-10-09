'use client';

import * as React from 'react';
import { getEffectsLevel } from '@/lib/ui-prefs-store';

/**
 * Press ripples for a control. `spawn` goes on onPointerDown; `ripples`
 * feed a RippleLayer inside the control. Ripples are skipped unless full
 * effects are on, so Lite and reduced motion never draw a frozen circle.
 */

export interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

const RIPPLE_MS = 600;

export function useRipple() {
  const [ripples, setRipples] = React.useState<Ripple[]>([]);
  const counter = React.useRef(0);
  const timers = React.useRef<number[]>([]);

  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) window.clearTimeout(timer);
    };
  }, []);

  const spawn = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (getEffectsLevel() !== 'full') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const id = ++counter.current;
    const ripple: Ripple = {
      id,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      size: Math.max(rect.width, rect.height) * 2,
    };
    setRipples((current) => [...current.slice(-3), ripple]);
    const timer = window.setTimeout(() => {
      setRipples((current) => current.filter((item) => item.id !== id));
      timers.current = timers.current.filter((t) => t !== timer);
    }, RIPPLE_MS);
    timers.current.push(timer);
  }, []);

  return { ripples, spawn };
}
