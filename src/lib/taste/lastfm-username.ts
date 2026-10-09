/**
 * Last.fm handles: 2 to 15 characters, a letter first, then letters, digits,
 * underscores or hyphens. Shared by the form (to enable the button) and the
 * server (to refuse anything else before calling Last.fm).
 */
export const LASTFM_USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{1,14}$/;

export function isLastfmUsername(value: unknown): value is string {
  return typeof value === 'string' && LASTFM_USERNAME_PATTERN.test(value);
}
