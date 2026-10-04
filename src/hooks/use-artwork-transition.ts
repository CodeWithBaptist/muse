'use client';

import * as React from 'react';
import { useReducedMotion } from 'motion/react';
import {
  ARTWORK_VIEW_TRANSITION_NAME,
  runSharedElementTransition,
  type SharedElementTransitionResult,
} from '@/lib/shared-element-transition';

export interface UseArtworkTransitionOptions {
  /** View transition name shared by the source and the destination artwork. */
  name?: string;
}

/**
 * Applies the artwork shared element transition. The source and the
 * destination artwork both call `artworkStyle(true)` while the transition is
 * active, which gives them the same `view-transition-name` so the browser
 * morphs one into the other. The update callback is where the navigation or
 * panel change happens.
 */
export function useArtworkTransition({
  name = ARTWORK_VIEW_TRANSITION_NAME,
}: UseArtworkTransitionOptions = {}) {
  const shouldReduceMotion = useReducedMotion() ?? false;

  const start = React.useCallback(
    (
      update: () => void,
      fallback?: () => void,
    ): Promise<SharedElementTransitionResult> =>
      runSharedElementTransition({
        update,
        fallback,
        reducedMotion: shouldReduceMotion,
      }),
    [shouldReduceMotion],
  );

  const artworkStyle = React.useCallback(
    (active: boolean): React.CSSProperties =>
      active ? ({ viewTransitionName: name } as React.CSSProperties) : {},
    [name],
  );

  return { start, artworkStyle, name };
}

export function artworkTransitionStyle(
  active: boolean,
  name: string = ARTWORK_VIEW_TRANSITION_NAME,
): React.CSSProperties {
  if (!active) return {};
  return { viewTransitionName: name } as React.CSSProperties;
}
