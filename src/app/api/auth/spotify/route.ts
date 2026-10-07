import { generateSpotifyAuthUrl, generateCodeChallenge } from '@/lib/spotify';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { getSpotifyLoginStatus } from '@/lib/spotify-config';
import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * A browser navigation (the landing button, a bookmarked URL) should land on a
 * page that explains the problem, not on a JSON body. Programmatic callers keep
 * the machine readable 503.
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

  const loginStatus = getSpotifyLoginStatus();
  if (!loginStatus.configured) {
    console.warn(
      `Spotify login is not configured. Missing or invalid: ${loginStatus.missing.join(', ')}.`,
    );
    if (wantsHtml(request)) {
      // A relative Location resolves against whatever origin the visitor used,
      // so the redirect also survives proxies and the 0.0.0.0 dev binding.
      return new NextResponse(null, {
        status: 303,
        headers: { Location: '/?error=auth_not_configured' },
      });
    }
    return NextResponse.json(
      { error: 'Spotify login is not configured yet.' },
      { status: 503 }
    );
  }

  const state = nanoid(16);
  const codeVerifier = nanoid(64);
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === 'production';

  // Store state and code_verifier in cookies to verify on callback
  cookieStore.set('spotify_auth_state', state, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  });
  cookieStore.set('spotify_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  });

  const authUrl = generateSpotifyAuthUrl(state, codeChallenge);

  return NextResponse.redirect(authUrl);
}
