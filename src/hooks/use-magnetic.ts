'use client';

import * as React from 'react';
import { getEffectsLevel } from '@/lib/ui-prefs-store';

/**
 * A control that leans a few pixels toward a mouse pointer. Only with a fine
 * pointer and full effects; touch screens and Lite get a plain button. The
 * transform is written straight to the element inside the event, so a move
 * never re-renders React.
 */

const MAX_SHIFT_PX = 5;
const PULL = 0.22;

function finePointer(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: fine)').matches
  );
}

export function useMagnetic() {
  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (
        event.pointerType !== 'mouse' ||
        getEffectsLevel() !== 'full' ||
        !finePointer()
      )
        return;
      const element = event.currentTarget;
      const rect = element.getBoundingClientRect();
      const dx = (event.clientX - (rect.left + rect.width / 2)) * PULL;
      const dy = (event.clientY - (rect.top + rect.height / 2)) * PULL;
      const x = Math.max(-MAX_SHIFT_PX, Math.min(MAX_SHIFT_PX, dx));
      const y = Math.max(-MAX_SHIFT_PX, Math.min(MAX_SHIFT_PX, dy));
      element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
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
