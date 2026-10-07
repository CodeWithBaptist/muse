/**
 * Spotify sign-in configuration.
 *
 * Sign-in needs more than a client id: the authorization request needs the
 * redirect URI, the token exchange needs the client secret, and storing the
 * tokens needs the encryption key. Reading all of them in one place keeps the
 * landing page, the auth routes, and any later settings screen in agreement
 * about whether "Connect Spotify" can actually work.
 *
 * Values are read at call time, never at module load, so a server that is
 * started with the variables set reports them correctly even if this module
 * was first imported during the build.
 */

export const SPOTIFY_LOGIN_ENV_VARS = [
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'SPOTIFY_REDIRECT_URI',
  'ENCRYPTION_KEY',
] as const;

export type SpotifyLoginEnvVar = (typeof SPOTIFY_LOGIN_ENV_VARS)[number];

export interface SpotifyLoginStatus {
  configured: boolean;
  /** Names of the missing or invalid variables, never their values. */
  missing: SpotifyLoginEnvVar[];
}

/** Mirrors the check in src/lib/encryption.ts, which refuses shorter keys. */
const MIN_ENCRYPTION_KEY_LENGTH = 32;

function isUsable(
  name: SpotifyLoginEnvVar,
  value: string | undefined,
): boolean {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length === 0) return false;
  if (name === 'ENCRYPTION_KEY')
    return trimmed.length >= MIN_ENCRYPTION_KEY_LENGTH;
  return true;
}

export function getSpotifyLoginStatus(
  env: Record<string, string | undefined> = process.env,
): SpotifyLoginStatus {
  const missing = SPOTIFY_LOGIN_ENV_VARS.filter(
    (name) => !isUsable(name, env[name]),
  );
  return { configured: missing.length === 0, missing };
}

export function isSpotifyLoginConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return getSpotifyLoginStatus(env).configured;
}
