import {
  DEFAULT_UI_PREFS,
  UI_PREFS_STORAGE_KEY,
  normaliseUiPrefs,
  resolveEffectsLevel,
  type EffectsEnvironment,
  type EffectsLevel,
  type UiPrefs,
} from './ui-prefs';

/**
 * On-device storage for the display choices, read through
 * useSyncExternalStore like the chat preferences. Writing a choice also
 * stamps <html> straight away so CSS follows without waiting for React.
 */

const listeners = new Set<() => void>();
let memoryRaw: string | null = null;
let cache: { raw: string | null; value: UiPrefs } = {
  raw: null,
  value: DEFAULT_UI_PREFS,
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
    return store.getItem(UI_PREFS_STORAGE_KEY);
  } catch {
    return memoryRaw;
  }
}

function parse(raw: string | null): UiPrefs {
  if (!raw) return DEFAULT_UI_PREFS;
  try {
    return normaliseUiPrefs(JSON.parse(raw));
  } catch {
    return DEFAULT_UI_PREFS;
  }
}

export function getUiPrefs(): UiPrefs {
  const raw = readRaw();
  if (raw !== cache.raw) cache = { raw, value: parse(raw) };
  return cache.value;
}

export function getServerUiPrefs(): UiPrefs {
  return DEFAULT_UI_PREFS;
}

interface ConnectionLike {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
}

function connection(): ConnectionLike | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & {
    connection?: ConnectionLike;
    mozConnection?: ConnectionLike;
    webkitConnection?: ConnectionLike;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

/** What the browser says right now about motion, data, and memory. */
export function readEffectsEnvironment(): EffectsEnvironment {
  if (typeof window === 'undefined') return { reducedMotion: false };
  const link = connection();
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    reducedMotion:
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: link?.saveData,
    effectiveType: link?.effectiveType,
    deviceMemory: nav.deviceMemory,
  };
}

export function getEffectsLevel(): EffectsLevel {
  return resolveEffectsLevel(getUiPrefs(), readEffectsEnvironment());
}

export function getServerEffectsLevel(): EffectsLevel {
  return 'full';
}

/** Stamps <html> so the stylesheet follows the choices immediately. */
export function applyUiPrefsToDocument(): void {
  if (typeof document === 'undefined') return;
  const prefs = getUiPrefs();
  const root = document.documentElement;
  root.setAttribute('data-theme', prefs.theme);
  root.style.colorScheme = prefs.theme;
  root.setAttribute('data-effects', getEffectsLevel());
  // The browser chrome follows the page background.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', prefs.theme === 'light' ? '#F7F6F2' : '#0B0B0C');
}

export function setUiPrefs(next: Partial<UiPrefs>): void {
  const value = normaliseUiPrefs({ ...getUiPrefs(), ...next });
  const raw = JSON.stringify(value);
  memoryRaw = raw;
  const store = storage();
  if (store) {
    try {
      store.setItem(UI_PREFS_STORAGE_KEY, raw);
    } catch {
      // Blocked storage: the in-memory copy still serves this visit.
    }
  }
  applyUiPrefsToDocument();
  for (const listener of listeners) listener();
}

export function subscribeUiPrefs(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window === 'undefined') return () => listeners.delete(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === UI_PREFS_STORAGE_KEY) {
      applyUiPrefsToDocument();
      listener();
    }
  };
  const onEnvironment = () => {
    applyUiPrefsToDocument();
    listener();
  };
  window.addEventListener('storage', onStorage);
  const motionQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  motionQuery?.addEventListener?.('change', onEnvironment);
  const link = connection();
  link?.addEventListener?.('change', onEnvironment);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
    motionQuery?.removeEventListener?.('change', onEnvironment);
    link?.removeEventListener?.('change', onEnvironment);
  };
}
