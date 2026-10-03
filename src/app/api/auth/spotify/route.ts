import { generateSpotifyAuthUrl, generateCodeChallenge } from '@/lib/spotify';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request?: Request) {
  if (request) {
    const rateLimited = await enforceRateLimit(request, {
      scope: 'auth:spotify:init',
      limit: 20,
      windowMs: 60_000,
    });
    if (rateLimited) return rateLimited;
  }

  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_REDIRECT_URI) {
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
