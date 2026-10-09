import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * Tester-only access to the Spotify features.
 *
 * Spotify sign-in and "Create in Spotify" are not for the public. Two
 * environment variables control who sees them, together or alone:
 *
 * - TESTER_KEY: a shared secret a tester enters once on /login. A valid key
 *   is exchanged for a signed, HttpOnly cookie (30 days) that reveals the
 *   Spotify sign-in and is required to start it.
 * - SPOTIFY_TESTER_EMAILS: a comma-separated list of Spotify account emails.
 *   When set, the callback refuses any Spotify account whose email is not on
 *   it, before anything is stored. When it is the only variable set, the
 *   sign-in is visible on /login (the page is not linked anywhere public)
 *   and the list is the gate.
 *
 * With neither set the Spotify sign-in is hidden and refused everywhere.
 * Nothing here is imported by the open chat path, so a normal visitor never
 * depends on any of it.
 */

export const TESTER_COOKIE = 'muse_tester';
export const TESTER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const TESTER_KEY_MIN_LENGTH = 16;

export type SpotifyAccessMode = 'hidden' | 'key' | 'allowlist';

/** The two variables this module reads; tests pass plain objects. */
export type TesterEnv = Record<string, string | undefined>;

export function testerEmails(env: TesterEnv = process.env): string[] {
  return (env.SPOTIFY_TESTER_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.includes('@'));
}

export function testerKey(env: TesterEnv = process.env): string | null {
  const value = env.TESTER_KEY?.trim() ?? '';
  return value.length >= TESTER_KEY_MIN_LENGTH ? value : null;
}

export function spotifyAccessMode(
  env: TesterEnv = process.env,
): SpotifyAccessMode {
  if (testerKey(env)) return 'key';
  if (testerEmails(env).length > 0) return 'allowlist';
  return 'hidden';
}

export function isTesterEmail(
  email: string | null | undefined,
  env: TesterEnv = process.env,
): boolean {
  if (!email) return false;
  return testerEmails(env).includes(email.trim().toLowerCase());
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Compares a submitted key with the configured one in constant time. */
export function isTesterKey(
  candidate: unknown,
  env: TesterEnv = process.env,
): boolean {
  const configured = testerKey(env);
  if (!configured || typeof candidate !== 'string') return false;
  return safeEqual(candidate.trim(), configured);
}

function sign(issuedAt: number, key: string): string {
  return createHmac('sha256', `${key}:tester-pass`)
    .update(String(issuedAt))
    .digest('base64url');
}

/** The cookie value: issue time and an HMAC over it, keyed by the tester key. */
export function signTesterPass(
  issuedAt = Date.now(),
  env: TesterEnv = process.env,
): string | null {
  const key = testerKey(env);
  if (!key) return null;
  return `${issuedAt}.${sign(issuedAt, key)}`;
}

export function verifyTesterPass(
  value: string | undefined,
  env: TesterEnv = process.env,
  now = Date.now(),
): boolean {
  const key = testerKey(env);
  if (!key || !value) return false;
  const [issuedAtRaw, signature] = value.split('.');
  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt) || !signature) return false;
  if (issuedAt > now + 60_000) return false;
  if (now - issuedAt > TESTER_COOKIE_MAX_AGE_SECONDS * 1000) return false;
  return safeEqual(signature, sign(issuedAt, key));
}

export function testerCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TESTER_COOKIE_MAX_AGE_SECONDS,
  };
}

/** Whether this request carries a valid tester pass (key mode only). */
export async function hasTesterPass(): Promise<boolean> {
  if (spotifyAccessMode() !== 'key') return false;
  const store = await cookies();
  return verifyTesterPass(store.get(TESTER_COOKIE)?.value);
}

/**
 * Whether the Spotify sign-in may be shown and started for this request:
 * always in allowlist mode (the callback enforces the list), only with a
 * valid pass in key mode, never when nothing is configured.
 */
export async function spotifyLoginVisible(): Promise<boolean> {
  const mode = spotifyAccessMode();
  if (mode === 'hidden') return false;
  if (mode === 'allowlist') return true;
  return hasTesterPass();
}
