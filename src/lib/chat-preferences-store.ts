import {
  DEFAULT_CHAT_PREFERENCES,
  normaliseChatPreferences,
  type ChatPreferences,
} from './chat-preferences';

/**
 * On-device storage for the scope and language choices, read through
 * useSyncExternalStore like the guest chat. The server snapshot is the
 * default, so the first paint matches on both sides and the saved choice
 * takes over right after hydration.
 */

export const CHAT_PREFERENCES_STORAGE_KEY = 'muse.chat.prefs.v1';

const listeners = new Set<() => void>();
let memoryRaw: string | null = null;
let cache: { raw: string | null; value: ChatPreferences } = {
  raw: null,
  value: DEFAULT_CHAT_PREFERENCES,
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
    return store.getItem(CHAT_PREFERENCES_STORAGE_KEY);
  } catch {
    return memoryRaw;
  }
}

function parse(raw: string | null): ChatPreferences {
  if (!raw) return DEFAULT_CHAT_PREFERENCES;
  try {
    return normaliseChatPreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_CHAT_PREFERENCES;
  }
}

export function getChatPreferences(): ChatPreferences {
  const raw = readRaw();
  if (raw !== cache.raw) cache = { raw, value: parse(raw) };
  return cache.value;
}

export function getServerChatPreferences(): ChatPreferences {
  return DEFAULT_CHAT_PREFERENCES;
}

export function setChatPreferences(next: Partial<ChatPreferences>): void {
  const value = normaliseChatPreferences({ ...getChatPreferences(), ...next });
  const raw = JSON.stringify(value);
  memoryRaw = raw;
  const store = storage();
  if (store) {
    try {
      store.setItem(CHAT_PREFERENCES_STORAGE_KEY, raw);
    } catch {
      // Blocked storage: the in-memory copy still serves this visit.
    }
  }
  for (const listener of listeners) listener();
}

export function subscribeChatPreferences(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CHAT_PREFERENCES_STORAGE_KEY)
      listener();
  };
  if (typeof window !== 'undefined')
    window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined')
      window.removeEventListener('storage', onStorage);
  };
}
