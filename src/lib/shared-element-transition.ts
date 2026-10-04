import { flushSync } from 'react-dom';

/**
 * Shared element transition for artwork that travels between a card or row and
 * the playlist header.
 *
 * The View Transitions API is used when the browser supports it: the artwork
 * element carries `view-transition-name` on the source screen, the same name on
 * the destination screen, and the browser morphs between the two snapshots.
 * When the API is unavailable, or when motion is reduced, the code path falls
 * back to a crossfade so the same code always has a visible result.
 */

export const ARTWORK_VIEW_TRANSITION_NAME = 'muse-artwork';

export type SharedElementTransitionResult = 'view-transition' | 'fallback';

export interface SharedElementTransitionOptions {
  /**
   * The DOM change that reveals the destination. It runs inside the view
   * transition update callback, or immediately on the fallback path.
   */
  update: () => void;
  /** Crossfade used when the View Transitions API is not available. */
  fallback?: () => void;
  reducedMotion?: boolean;
}

export function supportsViewTransitions(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof document.startViewTransition === 'function'
  );
}

export async function runSharedElementTransition({
  update,
  fallback,
  reducedMotion = false,
}: SharedElementTransitionOptions): Promise<SharedElementTransitionResult> {
  if (reducedMotion || !supportsViewTransitions()) {
    fallback?.();
    update();
    return 'fallback';
  }

  try {
    const transition = document.startViewTransition(() => {
      // flushSync keeps the update synchronous so React commits the
      // destination before the browser captures the new snapshot.
      flushSync(() => {
        update();
      });
    });

    if (transition && typeof transition.finished?.catch === 'function') {
      await transition.finished.catch(() => undefined);
    }
    return 'view-transition';
  } catch {
    // A failed view transition must never block the change itself.
    fallback?.();
    update();
    return 'fallback';
  }
}
