import type { RecommendedTrack } from '@/lib/ai/playlist-engine';
import type { SpotifyTrackItem } from '@/lib/validation/api-schemas';

/**
 * Where a visitor without an account keeps their chat.
 *
 * Nothing about a guest is stored on the server, so the browser holds the
 * conversation and sends the recent turns back for context. This is a tiny
 * external store over localStorage (with an in-memory fallback when storage
 * is blocked) so React can read it with useSyncExternalStore: the server
 * snapshot is empty, the browser snapshot is the saved chat, and every write
 * notifies subscribers, so no effect ever has to copy storage into state.
 */

export interface StoredChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tracks?: SpotifyTrackItem[];
  recommendations?: RecommendedTrack[];
  playlistTitle?: string;
  short?: boolean;
  isPlaylistSuggestion?: boolean;
  isStreaming?: boolean;
  noResults?: boolean;
}

export const GUEST_CHAT_STORAGE_KEY = 'muse.chat.local.v1';
export const GUEST_CHAT_MAX_MESSAGES = 40;

const EMPTY: readonly StoredChatMessage[] = Object.freeze([]);
const listeners = new Set<() => void>();

let memoryRaw: string | null = null;
let cache: { raw: string | null; messages: readonly StoredChatMessage[] } = {
  raw: null,
  messages: EMPTY,
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
    return store.getItem(GUEST_CHAT_STORAGE_KEY);
  } catch {
    return memoryRaw;
  }
}

function writeRaw(raw: string | null): void {
  memoryRaw = raw;
  const store = storage();
  if (!store) return;
  try {
    if (raw === null) store.removeItem(GUEST_CHAT_STORAGE_KEY);
    else store.setItem(GUEST_CHAT_STORAGE_KEY, raw);
  } catch {
    // Storage can be full or blocked (private mode); the chat still works.
  }
}

export function parseStoredMessages(
  raw: string | null,
): readonly StoredChatMessage[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const messages = parsed.filter(
      (entry): entry is StoredChatMessage =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        ((entry as StoredChatMessage).role === 'user' ||
          (entry as StoredChatMessage).role === 'assistant') &&
        typeof (entry as StoredChatMessage).content === 'string',
    );
    return messages.length > 0 ? messages : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** Browser snapshot. Referentially stable until the stored text changes. */
export function getGuestMessages(): readonly StoredChatMessage[] {
  const raw = readRaw();
  if (raw !== cache.raw) {
    cache = { raw, messages: parseStoredMessages(raw) };
  }
  return cache.messages;
}

/** Server snapshot: the server never knows a guest chat. */
export function getServerGuestMessages(): readonly StoredChatMessage[] {
  return EMPTY;
}

export function setGuestMessages(messages: readonly StoredChatMessage[]): void {
  const durable = messages
    .filter((message) => !message.isStreaming)
    .slice(-GUEST_CHAT_MAX_MESSAGES)
    .map(({ isStreaming: _streaming, ...rest }) => rest);
  writeRaw(durable.length === 0 ? null : JSON.stringify(durable));
  for (const listener of listeners) listener();
}

export function appendGuestMessage(message: StoredChatMessage): void {
  setGuestMessages([...getGuestMessages(), message]);
}

export function clearGuestMessages(): void {
  setGuestMessages([]);
}

export function subscribeGuestMessages(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === GUEST_CHAT_STORAGE_KEY) listener();
  };
  if (typeof window !== 'undefined')
    window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined')
      window.removeEventListener('storage', onStorage);
  };
}
