'use client';

import * as React from 'react';
import type { EffectsLevel, UiPrefs } from '@/lib/ui-prefs';
import {
  getEffectsLevel,
  getServerEffectsLevel,
  getServerUiPrefs,
  getUiPrefs,
  setUiPrefs,
  subscribeUiPrefs,
} from '@/lib/ui-prefs-store';

/** The visitor's theme, Lite mode, and sound choices, kept on the device. */
export function useUiPrefs(): [UiPrefs, (next: Partial<UiPrefs>) => void] {
  const prefs = React.useSyncExternalStore(
    subscribeUiPrefs,
    getUiPrefs,
    getServerUiPrefs,
  );
  return [prefs, setUiPrefs];
}

/**
 * How much this interface may move right now: `none` under reduced motion,
 * `lite` when chosen or when the connection or device asks for less, else
 * `full`. Every decorative effect reads this before doing anything.
 */
export function useEffectsLevel(): EffectsLevel {
  return React.useSyncExternalStore(
    subscribeUiPrefs,
    getEffectsLevel,
    getServerEffectsLevel,
  );
}
