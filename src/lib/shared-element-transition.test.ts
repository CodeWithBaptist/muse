import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ARTWORK_VIEW_TRANSITION_NAME,
  runSharedElementTransition,
  supportsViewTransitions,
} from './shared-element-transition';

type ViewTransitionStub = (update: () => void | Promise<void>) => ViewTransition;

function fakeTransition(): ViewTransition {
  return {
    finished: Promise.resolve(),
    ready: Promise.resolve(),
    updateCallbackDone: Promise.resolve(),
    types: new Set<string>(),
    skipTransition: () => {},
  } as unknown as ViewTransition;
}

function setStartViewTransition(value: unknown) {
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    writable: true,
    value,
  });
}

afterEach(() => {
  setStartViewTransition(undefined);
  vi.restoreAllMocks();
});

describe('shared element transition', () => {
  it('uses the crossfade fallback when the View Transitions API is unavailable', async () => {
    setStartViewTransition(undefined);
    expect(supportsViewTransitions()).toBe(false);

    const update = vi.fn();
    const fallback = vi.fn();
    const result = await runSharedElementTransition({ update, fallback });

    expect(result).toBe('fallback');
    expect(update).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('never animates when motion is reduced, but still applies the change', async () => {
    const startViewTransition = vi.fn<ViewTransitionStub>(() => fakeTransition());
    setStartViewTransition(startViewTransition);

    const update = vi.fn();
    const result = await runSharedElementTransition({
      update,
      reducedMotion: true,
    });

    expect(result).toBe('fallback');
    expect(update).toHaveBeenCalledTimes(1);
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it('runs the update inside a view transition when the browser supports it', async () => {
    let updateRan = false;
    const startViewTransition = vi.fn<ViewTransitionStub>((update) => {
      update();
      updateRan = true;
      return fakeTransition();
    });
    setStartViewTransition(startViewTransition);

    const update = vi.fn();
    const result = await runSharedElementTransition({ update });

    expect(result).toBe('view-transition');
    expect(updateRan).toBe(true);
    expect(update).toHaveBeenCalledTimes(1);
    expect(startViewTransition).toHaveBeenCalledTimes(1);
  });

  it('falls back instead of blocking the change when the transition throws', async () => {
    setStartViewTransition(() => {
      throw new Error('view transition failed');
    });

    const update = vi.fn();
    const fallback = vi.fn();
    const result = await runSharedElementTransition({ update, fallback });

    expect(result).toBe('fallback');
    expect(update).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('names the travelling artwork consistently', () => {
    expect(ARTWORK_VIEW_TRANSITION_NAME).toBe('muse-artwork');
  });
});
