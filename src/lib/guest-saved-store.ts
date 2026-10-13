import type { ListedTrack } from '@/lib/catalogue/types';

/**
 * Where a visitor without an account keeps the lists MUSE built for them.
 *
 * Nothing about a guest is stored on the server, so the browser holds the
 * generated lists. This is a small external store over localStorage (with an
 * in-memory fallback when storage is blocked) so React can read it with
 * useSyncExternalStore: the server snapshot is empty, the browser snapshot is
 * the saved lists, and every write notifies subscribers.
 *
 * The lists are a convenience, not a record: each one can be deleted, all of
 * them can be cleared, and clearing browser data removes them the same way.
 */

export interface SavedList {
  id: string;
  title: string;
  /** ISO timestamp of when the list was last saved or refreshed. */
  savedAt: string;
  tracks: ListedTrack[];
}

export const SAVED_LIST_STORAGE_KEY = 'muse.saved.lists.v1';
/** Newest first; the oldest list beyond this is dropped when a new one lands. */
export const SAVED_LIST_LIMIT = 20;
export const SAVED_LIST_DEFAULT_TITLE = 'MUSE mix';
export const SAVED_LIST_NOTE =
  'Saved items live in this browser and disappear if you clear your browser data.';

const EMPTY: readonly SavedList[] = Object.freeze([]);
const listeners = new Set<() => void>();

let memoryRaw: string | null = null;
let cache: { raw: string | null; lists: readonly SavedList[] } = {
  raw: null,
  lists: EMPTY,
};

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readRaw(): string | null {
  const store = storage();
  if (!store) return memoryRaw;
  try {
    return store.getItem(SAVED_LIST_STORAGE_KEY);
  } catch {
    return memoryRaw;
  }
}

function writeRaw(raw: string | null): void {
  memoryRaw = raw;
  const store = storage();
  if (!store) return;
  try {
    if (raw === null) store.removeItem(SAVED_LIST_STORAGE_KEY);
    else store.setItem(SAVED_LIST_STORAGE_KEY, raw);
  } catch {
    // Storage can be full or blocked (private mode); the chat still works.
  }
}

function isTrack(value: unknown): value is ListedTrack {
  if (!value || typeof value !== 'object') return false;
  const track = value as Partial<ListedTrack>;
  return (
    typeof track.id === 'string' &&
    typeof track.title === 'string' &&
    typeof track.artist === 'string' &&
    typeof track.why === 'string'
  );
}

/** Reads stored lists defensively: anything malformed is dropped, not shown. */
export function parseSavedLists(raw: string | null): readonly SavedList[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const lists = parsed.flatMap((entry): SavedList[] => {
      if (!entry || typeof entry !== 'object') return [];
      const candidate = entry as Partial<SavedList>;
      if (
        typeof candidate.id !== 'string' ||
        typeof candidate.title !== 'string' ||
        typeof candidate.savedAt !== 'string' ||
        !Array.isArray(candidate.tracks)
      ) {
        return [];
      }
      const tracks = candidate.tracks.filter(isTrack);
      if (tracks.length === 0) return [];
      return [
        {
          id: candidate.id,
          title: candidate.title,
          savedAt: candidate.savedAt,
          tracks,
        },
      ];
    });
    return lists.length > 0 ? lists : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** Browser snapshot. Referentially stable until the stored text changes. */
export function getSavedLists(): readonly SavedList[] {
  const raw = readRaw();
  if (raw !== cache.raw) {
    cache = { raw, lists: parseSavedLists(raw) };
  }
  return cache.lists;
}

/** Server snapshot: the server never knows a guest's saved lists. */
export function getServerSavedLists(): readonly SavedList[] {
  return EMPTY;
}

function write(lists: readonly SavedList[]): void {
  writeRaw(lists.length === 0 ? null : JSON.stringify(lists));
  for (const listener of listeners) listener();
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Two lists count as the same when the title and the songs both match. */
function sameList(
  list: SavedList,
  title: string,
  tracks: ListedTrack[],
): boolean {
  if (list.title !== title || list.tracks.length !== tracks.length)
    return false;
  return list.tracks.every((track, index) => track.id === tracks[index]?.id);
}

/**
 * Keeps a list MUSE just built. The same list saved again is refreshed in
 * place and moved to the top rather than duplicated; the oldest list beyond
 * the limit is dropped.
 */
export function saveGuestList(input: {
  title?: string | null;
  tracks: readonly ListedTrack[];
  savedAt?: string;
}): SavedList | null {
  const tracks = input.tracks.filter(isTrack);
  if (tracks.length === 0) return null;
  const title = input.title?.trim() || SAVED_LIST_DEFAULT_TITLE;
  const savedAt = input.savedAt ?? new Date().toISOString();
  const current = getSavedLists();
  const existing = current.find((list) => sameList(list, title, tracks));
  const entry: SavedList = {
    id: existing?.id ?? newId(),
    title,
    savedAt,
    tracks: [...tracks],
  };
  const rest = current.filter((list) => list.id !== entry.id);
  write([entry, ...rest].slice(0, SAVED_LIST_LIMIT));
  return entry;
}

export function deleteSavedList(id: string): void {
  const current = getSavedLists();
  const next = current.filter((list) => list.id !== id);
  if (next.length === current.length) return;
  write(next);
}

export function clearSavedLists(): void {
  if (getSavedLists().length === 0 && readRaw() === null) return;
  write([]);
}

export function subscribeSavedLists(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SAVED_LIST_STORAGE_KEY) listener();
  };
  if (typeof window !== 'undefined')
    window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined')
      window.removeEventListener('storage', onStorage);
  };
}
