import { db } from '@/db';
import { spotifyAccounts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt, encrypt } from './encryption';

export const SPOTIFY_RECONNECT_CODE = 'SPOTIFY_RECONNECT_REQUIRED' as const;
export const SPOTIFY_RECONNECT_MESSAGE =
  'Spotify connection expired. Please reconnect your Spotify account.';

export class SpotifyReconnectError extends Error {
  readonly code = SPOTIFY_RECONNECT_CODE;

  constructor(message = SPOTIFY_RECONNECT_MESSAGE) {
    super(message);
    this.name = 'SpotifyReconnectError';
  }
}

export function isSpotifyReconnectError(error: unknown): boolean {
  if (error instanceof SpotifyReconnectError) {
    return true;
  }
  if (error && typeof error === 'object') {
    const code = (error as { code?: unknown }).code;
    const message = (error as { message?: unknown }).message;
    if (code === SPOTIFY_RECONNECT_CODE) return true;
    if (
      typeof message === 'string' &&
      /Spotify connection expired|Spotify token might be invalid|Spotify account not found/i.test(
        message
      )
    ) {
      return true;
    }
  }
  return false;
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID || '';
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';

  if (!clientId || !clientSecret) {
    throw new Error(
      'Spotify credentials (CLIENT_ID/CLIENT_SECRET) are not configured in environment variables.'
    );
  }

  const [account] = await db
    .select()
    .from(spotifyAccounts)
    .where(eq(spotifyAccounts.userId, userId));

  if (!account) {
    throw new SpotifyReconnectError();
  }

  // If token is still valid (with 1 minute buffer)
  if (account.expiresAt.getTime() > Date.now() + 60 * 1000) {
    return decrypt(account.accessToken);
  }

  // Refresh token
  const refreshToken = decrypt(account.refreshToken);

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      throw new SpotifyReconnectError();
    }
    throw new Error('Failed to refresh Spotify access token');
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  const encryptedAccessToken = encrypt(data.access_token);
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  const updateData: Partial<typeof spotifyAccounts.$inferInsert> = {
    accessToken: encryptedAccessToken,
    expiresAt,
    updatedAt: new Date(),
  };

  if (data.refresh_token) {
    updateData.refreshToken = encrypt(data.refresh_token);
  }

  await db
    .update(spotifyAccounts)
    .set(updateData)
    .where(eq(spotifyAccounts.userId, userId));

  return data.access_token;
}
