'use client';

import * as React from 'react';
import type { TasteSnapshot } from '@/lib/taste/types';
import {
  clearTasteSnapshot,
  getServerTasteSnapshot,
  getTasteSnapshot,
  setTasteSnapshot,
  subscribeTasteSnapshot,
} from '@/lib/taste/store';

export interface TasteState {
  snapshot: TasteSnapshot | null;
  save: (snapshot: TasteSnapshot) => void;
  clear: () => void;
}

/** The visitor's listening snapshot, kept on the device and nowhere else. */
export function useTaste(): TasteState {
  const snapshot = React.useSyncExternalStore(
    subscribeTasteSnapshot,
    getTasteSnapshot,
    getServerTasteSnapshot,
  );
  return React.useMemo(
    () => ({ snapshot, save: setTasteSnapshot, clear: clearTasteSnapshot }),
    [snapshot],
  );
}
