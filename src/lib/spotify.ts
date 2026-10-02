import { nanoid } from 'nanoid';
import crypto from 'crypto';

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || '';
const SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-top-read',
  'user-read-recently-played',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-library-read',
  'streaming',
  'user-read-playback-state',
  'user-modify-playback-state'
].join(' ');

export function generateSpotifyAuthUrl(state: string, codeChallenge: string) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    state,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export function generateCodeChallenge(codeVerifier: string) {
  return crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: process.env.SPOTIFY_CLIENT_SECRET!,
    code_verifier: codeVerifier,
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to exchange code: ${JSON.stringify(error)}`);
  }

  return response.json();
}

export async function getSpotifyUserProfile(accessToken: string) {
  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Spotify profile');
  }

  return response.json();
}
