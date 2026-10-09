'use client';

import * as React from 'react';
import { getEffectsLevel } from '@/lib/ui-prefs-store';

/**
 * A card that tilts a few degrees toward a mouse pointer. Fine pointers and
 * full effects only; the transform is written in the event, never through
 * React state, and cleared when the pointer leaves.
 */

const MAX_DEG = 3;

export function useTilt() {
  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType !== 'mouse' || getEffectsLevel() !== 'full') return;
      if (!window.matchMedia('(pointer: fine)').matches) return;
      const element = event.currentTarget;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      const rotateY = (px * MAX_DEG * 2).toFixed(2);
      const rotateX = (-py * MAX_DEG * 2).toFixed(2);
      element.style.transform = `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    },
    [],
  );

  const onPointerLeave = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      event.currentTarget.style.transform = '';
    },
    [],
  );

  return { onPointerMove, onPointerLeave };
}
