import crypto from 'crypto';

const SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-top-read',
  'user-read-recently-played',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-library-read',
  'user-read-playback-state',
  'user-modify-playback-state'
].join(' ');

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token: string;
}

export interface SpotifyUserProfileResponse {
  id: string;
  display_name: string;
  email: string;
  images?: Array<{ url: string }>;
}

export function generateSpotifyAuthUrl(state: string, codeChallenge: string) {
  const clientId = process.env.SPOTIFY_CLIENT_ID || '';
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || '';

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
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

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<SpotifyTokenResponse> {
  const clientId = process.env.SPOTIFY_CLIENT_ID || '';
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || '';

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
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
    throw new SpotifyAuthRequestError(
      'Failed to exchange Spotify authorization code',
      response.status,
    );
  }

  return response.json() as Promise<SpotifyTokenResponse>;
}

/**
 * A failed request to Spotify during sign-in. The status lets the callback
 * tell "Spotify refused this account" (403 while the app is in development
 * mode) apart from everything else.
 */
export class SpotifyAuthRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'SpotifyAuthRequestError';
  }
}

export async function getSpotifyUserProfile(
  accessToken: string
): Promise<SpotifyUserProfileResponse> {
  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new SpotifyAuthRequestError('Failed to fetch Spotify profile', response.status);
  }

  return response.json() as Promise<SpotifyUserProfileResponse>;
}
