// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TASTE_STORAGE_KEY,
  clearTasteSnapshot,
  getServerTasteSnapshot,
  getTasteSnapshot,
  setTasteSnapshot,
  subscribeTasteSnapshot,
} from './store';
import type { TasteSnapshot } from './types';

const snapshot: TasteSnapshot = {
  source: 'lastfm',
  label: 'Last.fm: ada',
  sourceUrl: 'https://www.last.fm/user/ada',
  topArtists: [{ name: 'Asake', plays: 312 }],
  topTracks: [{ title: 'Lonely At The Top', artist: 'Asake', plays: 40 }],
  recentTracks: [{ title: 'Last Last', artist: 'Burna Boy' }],
  capturedAt: '2024-03-01T00:00:00.000Z',
};

describe('taste store', () => {
  beforeEach(() => {
    clearTasteSnapshot();
    window.localStorage.clear();
  });

  it('is empty on the server and on a fresh device', () => {
    expect(getServerTasteSnapshot()).toBeNull();
    expect(getTasteSnapshot()).toBeNull();
  });

  it('saves, notifies, reads back, and clears the only copy', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTasteSnapshot(listener);
    setTasteSnapshot(snapshot);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getTasteSnapshot()).toEqual(snapshot);
    expect(window.localStorage.getItem(TASTE_STORAGE_KEY)).toContain('Asake');
    clearTasteSnapshot();
    expect(getTasteSnapshot()).toBeNull();
    expect(window.localStorage.getItem(TASTE_STORAGE_KEY)).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('ignores anything in storage that is not a snapshot', () => {
    window.localStorage.setItem(TASTE_STORAGE_KEY, '{"source":"lastfm"}');
    expect(getTasteSnapshot()).toBeNull();
    window.localStorage.setItem(TASTE_STORAGE_KEY, 'not json');
    expect(getTasteSnapshot()).toBeNull();
  });
});
