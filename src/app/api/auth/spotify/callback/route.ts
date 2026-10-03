import { exchangeCodeForTokens, getSpotifyUserProfile } from '@/lib/spotify';
import { db } from '@/db';
import { users, spotifyAccounts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { encrypt } from '@/lib/encryption';
import { createSession } from '@/lib/session';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { SpotifyCallbackQuerySchema } from '@/lib/validation/api-schemas';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const rateLimited = await enforceRateLimit(request, {
    scope: 'auth:spotify:callback',
    limit: 20,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const url = new URL(request.url);
  const parsedQuery = SpotifyCallbackQuerySchema.safeParse({
    code: url.searchParams.get('code') ?? undefined,
    state: url.searchParams.get('state') ?? undefined,
    error: url.searchParams.get('error') ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
  }

  const { code, state, error } = parsedQuery.data;

  const cookieStore = await cookies();
  const storedState = cookieStore.get('spotify_auth_state')?.value;
  const codeVerifier = cookieStore.get('spotify_code_verifier')?.value;

  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/?error=auth_not_configured', request.url));
  }

  if (error || !code || !state || state !== storedState || !codeVerifier) {
    console.error('Auth error or state mismatch during Spotify callback');
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code, codeVerifier);
    const profile = await getSpotifyUserProfile(tokens.access_token);

    let [user] = await db.select().from(users).where(eq(users.spotifyId, profile.id));

    if (!user) {
      [user] = await db.insert(users).values({
        spotifyId: profile.id,
        displayName: profile.display_name,
        email: profile.email,
        avatarUrl: profile.images?.[0]?.url,
      }).returning();
    } else {
      await db.update(users).set({
        displayName: profile.display_name,
        email: profile.email,
        avatarUrl: profile.images?.[0]?.url,
        updatedAt: new Date(),
      }).where(eq(users.id, user.id));
    }

    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = encrypt(tokens.refresh_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const [existingAccount] = await db.select().from(spotifyAccounts).where(eq(spotifyAccounts.userId, user.id));

    if (existingAccount) {
      await db.update(spotifyAccounts).set({
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt,
        scope: tokens.scope,
        updatedAt: new Date(),
      }).where(eq(spotifyAccounts.userId, user.id));
    } else {
      await db.insert(spotifyAccounts).values({
        userId: user.id,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt,
        scope: tokens.scope,
      });
    }

    await createSession(user.id);

    cookieStore.delete('spotify_auth_state');
    cookieStore.delete('spotify_code_verifier');

    return NextResponse.redirect(new URL('/chat', request.url));
  } catch (err) {
    console.error('Failed to handle Spotify callback:', err);
    return NextResponse.redirect(new URL('/?error=token_exchange_failed', request.url));
  }
}
