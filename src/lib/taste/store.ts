import { parseTasteSnapshot, type TasteSnapshot } from './types';

/**
 * On-device storage for the taste snapshot, read through
 * useSyncExternalStore like the chat preferences. The server snapshot is
 * always null so the first paint matches on both sides; the saved value
 * takes over right after hydration. Clearing it is one call and removes
 * the only copy that exists.
 */

export const TASTE_STORAGE_KEY = 'muse.taste.v1';

const listeners = new Set<() => void>();
let memoryRaw: string | null = null;
let cache: { raw: string | null; value: TasteSnapshot | null } = {
  raw: null,
  value: null,
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
    return store.getItem(TASTE_STORAGE_KEY);
  } catch {
    return memoryRaw;
  }
}

function parse(raw: string | null): TasteSnapshot | null {
  if (!raw) return null;
  try {
    return parseTasteSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function getTasteSnapshot(): TasteSnapshot | null {
  const raw = readRaw();
  if (raw !== cache.raw) cache = { raw, value: parse(raw) };
  return cache.value;
}

export function getServerTasteSnapshot(): TasteSnapshot | null {
  return null;
}

function write(raw: string | null): void {
  memoryRaw = raw;
  const store = storage();
  if (store) {
    try {
      if (raw === null) store.removeItem(TASTE_STORAGE_KEY);
      else store.setItem(TASTE_STORAGE_KEY, raw);
    } catch {
      // Blocked or full storage: the in-memory copy still serves this visit.
    }
  }
  for (const listener of listeners) listener();
}

export function setTasteSnapshot(snapshot: TasteSnapshot): void {
  write(JSON.stringify(snapshot));
}

export function clearTasteSnapshot(): void {
  write(null);
}

export function subscribeTasteSnapshot(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === TASTE_STORAGE_KEY) listener();
  };
  if (typeof window !== 'undefined')
    window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined')
      window.removeEventListener('storage', onStorage);
  };
}
