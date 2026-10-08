import { generateSpotifyAuthUrl, generateCodeChallenge } from '@/lib/spotify';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { getSpotifyLoginStatus } from '@/lib/spotify-config';
import {
  AUTH_COOKIE_NEXT,
  AUTH_COOKIE_STATE,
  AUTH_COOKIE_VERIFIER,
  handshakeCookieOptions,
  loginPathForError,
  redirectTo,
  safeNextPath,
} from '@/lib/auth-flow';
import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Starts the Spotify sign-in (Authorization Code with PKCE).
 *
 * The state and the code verifier are kept in short-lived HttpOnly cookies and
 * checked by the callback. An optional "next" query parameter names the in-app
 * path to return to afterwards; anything that is not an in-app path is
 * ignored, so this can never redirect off the site.
 *
 * A browser navigation (the Connect button, a bookmarked URL) that cannot be
 * served lands on the login page with an explanation. Programmatic callers
 * keep the machine readable 503.
 */
function wantsHtml(request?: Request): boolean {
  return request?.headers.get('accept')?.includes('text/html') ?? false;
}

export async function GET(request?: Request) {
  if (request) {
    const rateLimited = await enforceRateLimit(request, {
      scope: 'auth:spotify:init',
      limit: 20,
      windowMs: 60_000,
    });
    if (rateLimited) return rateLimited;
  }

  const next = request
    ? safeNextPath(new URL(request.url).searchParams.get('next'))
    : null;

  const loginStatus = getSpotifyLoginStatus();
  if (!loginStatus.configured) {
    console.warn(
      `Spotify login is not configured. Missing or invalid: ${loginStatus.missing.join(', ')}.`,
    );
    if (wantsHtml(request)) {
      return redirectTo(loginPathForError('auth_not_configured', next));
    }
    return NextResponse.json(
      { error: 'Spotify login is not configured yet.' },
      { status: 503 },
    );
  }

  const state = nanoid(16);
  const codeVerifier = nanoid(64);
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const cookieStore = await cookies();
  const options = handshakeCookieOptions(process.env.NODE_ENV === 'production');

  cookieStore.set(AUTH_COOKIE_STATE, state, options);
  cookieStore.set(AUTH_COOKIE_VERIFIER, codeVerifier, options);
  if (next) {
    cookieStore.set(AUTH_COOKIE_NEXT, next, options);
  } else {
    cookieStore.delete(AUTH_COOKIE_NEXT);
  }

  return NextResponse.redirect(generateSpotifyAuthUrl(state, codeChallenge));
}
