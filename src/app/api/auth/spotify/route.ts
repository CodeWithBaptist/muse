import { generateSpotifyAuthUrl, generateCodeChallenge } from '@/lib/spotify';
import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_REDIRECT_URI) {
    return new Response(
      'MUSE Error: Spotify configuration is missing. Please set SPOTIFY_CLIENT_ID and SPOTIFY_REDIRECT_URI in your environment variables.',
      { status: 500 }
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
