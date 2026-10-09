'use client';

import { useSyncExternalStore } from 'react';
import { getVibe, subscribeVibe } from '@/lib/vibe-store';

const getServerVibe = () => null;

/** The prompt the page is dressed for, or null before the first message. */
export function useVibe(): string | null {
  return useSyncExternalStore(subscribeVibe, getVibe, getServerVibe);
}
