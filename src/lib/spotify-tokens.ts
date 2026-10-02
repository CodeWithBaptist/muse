import { db } from '@/db';
import { spotifyAccounts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt, encrypt } from './encryption';

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';

export async function getValidAccessToken(userId: string): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Spotify credentials (CLIENT_ID/CLIENT_SECRET) are not configured in environment variables.');
  }
  const [account] = await db
    .select()
    .from(spotifyAccounts)
    .where(eq(spotifyAccounts.userId, userId));

  if (!account) {
    throw new Error('Spotify account not found for user');
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
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
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
    throw new Error(`Failed to refresh Spotify token: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  
  const encryptedAccessToken = encrypt(data.access_token);
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);
  
  // Update tokens in DB
  const updateData: any = {
    accessToken: encryptedAccessToken,
    expiresAt,
    updatedAt: new Date(),
  };

  // Spotify might return a new refresh token
  if (data.refresh_token) {
    updateData.refreshToken = encrypt(data.refresh_token);
  }

  await db
    .update(spotifyAccounts)
    .set(updateData)
    .where(eq(spotifyAccounts.userId, userId));

  return data.access_token;
}
