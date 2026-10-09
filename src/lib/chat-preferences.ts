/**
 * The two choices a visitor makes about how MUSE answers: where the music
 * should lean, and what language the words come in. Shared by the browser
 * (stored on the device) and the server (validated on every request), so
 * the vocabulary lives here and nowhere else.
 */

export const MUSIC_SCOPES = ['nigeria', 'global'] as const;
export type MusicScope = (typeof MUSIC_SCOPES)[number];

export const CHAT_LANGUAGES = ['english', 'pidgin', 'mix'] as const;
export type ChatLanguage = (typeof CHAT_LANGUAGES)[number];

export interface ChatPreferences {
  /** `nigeria` leads with Nigerian and African music; `global` has no lean. */
  scope: MusicScope;
  /** The language of MUSE's own words; song titles stay as released. */
  language: ChatLanguage;
}

export const DEFAULT_CHAT_PREFERENCES: ChatPreferences = Object.freeze({
  scope: 'nigeria',
  language: 'english',
});

export const MUSIC_SCOPE_LABELS: Record<MusicScope, string> = {
  nigeria: 'Naija first',
  global: 'Global',
};

export const CHAT_LANGUAGE_LABELS: Record<ChatLanguage, string> = {
  english: 'English',
  pidgin: 'Pidgin',
  mix: 'Mix',
};

export function isMusicScope(value: unknown): value is MusicScope {
  return (
    typeof value === 'string' &&
    (MUSIC_SCOPES as readonly string[]).includes(value)
  );
}

export function isChatLanguage(value: unknown): value is ChatLanguage {
  return (
    typeof value === 'string' &&
    (CHAT_LANGUAGES as readonly string[]).includes(value)
  );
}

/** Fills gaps and drops anything unknown, so callers always hold a full value. */
export function normaliseChatPreferences(value: unknown): ChatPreferences {
  if (!value || typeof value !== 'object') return DEFAULT_CHAT_PREFERENCES;
  const candidate = value as Partial<Record<keyof ChatPreferences, unknown>>;
  return {
    scope: isMusicScope(candidate.scope)
      ? candidate.scope
      : DEFAULT_CHAT_PREFERENCES.scope,
    language: isChatLanguage(candidate.language)
      ? candidate.language
      : DEFAULT_CHAT_PREFERENCES.language,
  };
}
