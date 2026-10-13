import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListedTrack } from '@/lib/catalogue/types';
import {
  SAVED_LIST_DEFAULT_TITLE,
  SAVED_LIST_LIMIT,
  SAVED_LIST_NOTE,
  SAVED_LIST_STORAGE_KEY,
  clearSavedLists,
  deleteSavedList,
  getSavedLists,
  parseSavedLists,
  saveGuestList,
  subscribeSavedLists,
} from './guest-saved-store';

function track(id: string, title = id): ListedTrack {
  return { id, title, artist: 'Ada', why: 'Fits.', region: 'Nigeria' };
}

function stored(): unknown {
  return JSON.parse(
    window.localStorage.getItem(SAVED_LIST_STORAGE_KEY) ?? '[]',
  );
}

describe('guest saved lists', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearSavedLists();
  });

  it('keeps the list, the title, and the time it was saved', () => {
    const saved = saveGuestList({
      title: 'Third Mainland at 1am',
      tracks: [track('a'), track('b')],
      savedAt: '2026-10-13T09:00:00.000Z',
    });
    expect(saved).not.toBeNull();
    expect(getSavedLists()).toHaveLength(1);
    expect(getSavedLists()[0]).toMatchObject({
      title: 'Third Mainland at 1am',
      savedAt: '2026-10-13T09:00:00.000Z',
    });
    expect(getSavedLists()[0].tracks.map((entry) => entry.id)).toEqual([
      'a',
      'b',
    ]);
    expect(window.localStorage.getItem(SAVED_LIST_STORAGE_KEY)).toContain(
      'Third Mainland at 1am',
    );
  });

  it('falls back to a plain title and refuses an empty list', () => {
    expect(saveGuestList({ title: '   ', tracks: [track('a')] })?.title).toBe(
      SAVED_LIST_DEFAULT_TITLE,
    );
    expect(saveGuestList({ title: 'Nothing', tracks: [] })).toBeNull();
    expect(getSavedLists()).toHaveLength(1);
  });

  it('refreshes the same list instead of duplicating it, newest first', () => {
    saveGuestList({
      title: 'Mix',
      tracks: [track('a')],
      savedAt: '2026-10-13T09:00:00.000Z',
    });
    saveGuestList({ title: 'Other', tracks: [track('b')] });
    saveGuestList({
      title: 'Mix',
      tracks: [track('a')],
      savedAt: '2026-10-13T10:00:00.000Z',
    });
    const lists = getSavedLists();
    expect(lists.map((list) => list.title)).toEqual(['Mix', 'Other']);
    expect(lists[0].savedAt).toBe('2026-10-13T10:00:00.000Z');
  });

  it('keeps the newest lists and drops the oldest beyond the limit', () => {
    for (let index = 0; index < SAVED_LIST_LIMIT + 2; index += 1) {
      saveGuestList({ title: `Mix ${index}`, tracks: [track(`t${index}`)] });
    }
    const lists = getSavedLists();
    expect(lists).toHaveLength(SAVED_LIST_LIMIT);
    expect(lists[0].title).toBe(`Mix ${SAVED_LIST_LIMIT + 1}`);
    expect(lists.some((list) => list.title === 'Mix 0')).toBe(false);
  });

  it('deletes one list and clears all of them', () => {
    const first = saveGuestList({ title: 'One', tracks: [track('a')] })!;
    saveGuestList({ title: 'Two', tracks: [track('b')] });
    deleteSavedList(first.id);
    expect(getSavedLists().map((list) => list.title)).toEqual(['Two']);
    clearSavedLists();
    expect(getSavedLists()).toEqual([]);
    expect(window.localStorage.getItem(SAVED_LIST_STORAGE_KEY)).toBeNull();
  });

  it('ignores malformed stored text rather than showing it', () => {
    expect(parseSavedLists('not json')).toEqual([]);
    expect(parseSavedLists('{"nope":true}')).toEqual([]);
    expect(
      parseSavedLists(
        JSON.stringify([
          {
            id: 'x',
            title: 'Kept',
            savedAt: '2026-10-13T00:00:00.000Z',
            tracks: [track('a')],
          },
          {
            id: 'y',
            title: 'No tracks',
            savedAt: '2026-10-13T00:00:00.000Z',
            tracks: [],
          },
          { id: 'z', tracks: 'wrong' },
        ]),
      ).map((list) => list.title),
    ).toEqual(['Kept']);
  });

  it('notifies subscribers on every write and on a storage event', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSavedLists(listener);
    saveGuestList({ title: 'One', tracks: [track('a')] });
    expect(listener).toHaveBeenCalledTimes(1);
    clearSavedLists();
    expect(listener).toHaveBeenCalledTimes(2);
    window.dispatchEvent(
      new StorageEvent('storage', { key: SAVED_LIST_STORAGE_KEY }),
    );
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    saveGuestList({ title: 'Two', tracks: [track('b')] });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('states the plain note the chat shows next to the saved lists', () => {
    expect(SAVED_LIST_NOTE).toBe(
      'Saved items live in this browser and disappear if you clear your browser data.',
    );
  });
});
