/**
 * Shared pieces of the Spotify sign-in flow: cookie names, the return path
 * rules, the error codes the routes can send the login page, and the redirect
 * helper. Kept free of Next.js imports so the rules are unit testable.
 */

/** PKCE state, the code verifier, and the return path travel in these cookies. */
export const AUTH_COOKIE_STATE = 'spotify_auth_state';
export const AUTH_COOKIE_VERIFIER = 'spotify_code_verifier';
export const AUTH_COOKIE_NEXT = 'spotify_auth_next';
export const AUTH_HANDSHAKE_COOKIES = [
  AUTH_COOKIE_STATE,
  AUTH_COOKIE_VERIFIER,
  AUTH_COOKIE_NEXT,
] as const;

/** Spotify's authorization page has to be completed within this window. */
export const AUTH_HANDSHAKE_MAX_AGE_SECONDS = 60 * 10;

export const DEFAULT_AFTER_LOGIN = '/chat';
export const LOGIN_PATH = '/login';

/**
 * Every reason the callback can send someone back to the login page. The
 * login page explains each one; unknown codes fall back to a generic notice.
 */
export const AUTH_ERROR_CODES = [
  'access_denied',
  'session_expired',
  'state_mismatch',
  'auth_not_configured',
  'user_not_registered',
  'testers_only',
  'not_a_tester',
  'token_exchange_failed',
  'auth_failed',
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export function isAuthErrorCode(value: string): value is AuthErrorCode {
  return (AUTH_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Accepts only an in-app path to return to after sign-in: it must start with a
 * single slash, carry no scheme, host, backslash, or control characters, and
 * must not point back at the login page or at an API route. Anything else is
 * dropped so the flow can never be used as an open redirect.
 */
export function safeNextPath(
  value: string | string[] | null | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || raw.length > 512) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\'))
    return null;
  if (/[\u0000-\u001f\u007f\s]/.test(raw)) return null;
  if (raw.includes('\\')) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw, 'http://muse.invalid');
  } catch {
    return null;
  }
  if (parsed.origin !== 'http://muse.invalid') return null;

  const path = parsed.pathname;
  if (path === LOGIN_PATH || path.startsWith(`${LOGIN_PATH}/`)) return null;
  if (path === '/api' || path.startsWith('/api/')) return null;

  return `${parsed.pathname}${parsed.search}`;
}

/** Where the callback sends people when sign-in cannot finish. */
export function loginPathForError(
  code: AuthErrorCode,
  next?: string | null,
): string {
  const params = new URLSearchParams({ error: code });
  const safeNext = safeNextPath(next);
  if (safeNext && safeNext !== DEFAULT_AFTER_LOGIN)
    params.set('next', safeNext);
  return `${LOGIN_PATH}?${params.toString()}`;
}

/** Where the shell sends signed out visitors, remembering where they were. */
export function loginPathForReturn(pathname: string | null): string {
  const safeNext = safeNextPath(pathname);
  if (!safeNext || safeNext === DEFAULT_AFTER_LOGIN) return LOGIN_PATH;
  return `${LOGIN_PATH}?${new URLSearchParams({ next: safeNext }).toString()}`;
}

/**
 * A 303 with a relative Location. The browser resolves it against the origin
 * it is actually using, so the redirect survives proxies and a dev server
 * bound to 0.0.0.0, where request.url would point at the wrong host.
 */
export function redirectTo(
  location: string,
  init?: { headers?: Record<string, string> },
): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: location,
      'Cache-Control': 'no-store',
      ...(init?.headers ?? {}),
    },
  });
}

export function handshakeCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: AUTH_HANDSHAKE_MAX_AGE_SECONDS,
    path: '/',
  };
}
