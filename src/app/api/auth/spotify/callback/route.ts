import {
  exchangeCodeForTokens,
  getSpotifyUserProfile,
  SpotifyAuthRequestError,
} from '@/lib/spotify';
import { db } from '@/db';
import { users, spotifyAccounts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { encrypt } from '@/lib/encryption';
import { createSession } from '@/lib/session';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { SpotifyCallbackQuerySchema } from '@/lib/validation/api-schemas';
import { isSpotifyLoginConfigured } from '@/lib/spotify-config';
import {
  AUTH_COOKIE_NEXT,
  AUTH_COOKIE_STATE,
  AUTH_COOKIE_VERIFIER,
  AUTH_HANDSHAKE_COOKIES,
  DEFAULT_AFTER_LOGIN,
  loginPathForError,
  redirectTo,
  safeNextPath,
  type AuthErrorCode,
} from '@/lib/auth-flow';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

/**
 * Finishes the Spotify sign-in.
 *
 * Every way this can stop maps to one error code, and the login page explains
 * each. The handshake cookies are cleared on every path so a stale state can
 * never be replayed, and all redirects are relative so they land on the origin
 * the visitor is actually using.
 */
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

  const cookieStore = await cookies();
  const storedState = cookieStore.get(AUTH_COOKIE_STATE)?.value;
  const codeVerifier = cookieStore.get(AUTH_COOKIE_VERIFIER)?.value;
  const next = safeNextPath(cookieStore.get(AUTH_COOKIE_NEXT)?.value);

  const clearHandshake = () => {
    for (const name of AUTH_HANDSHAKE_COOKIES) cookieStore.delete(name);
  };
  const fail = (code: AuthErrorCode) => {
    clearHandshake();
    return redirectTo(loginPathForError(code, next));
  };

  if (!parsedQuery.success) return fail('auth_failed');
  const { code, state, error } = parsedQuery.data;

  if (!isSpotifyLoginConfigured()) return fail('auth_not_configured');

  // Spotify sends error=access_denied when the visitor declines on its page.
  if (error) {
    return fail(error === 'access_denied' ? 'access_denied' : 'auth_failed');
  }

  // No handshake cookies: the ten minute window passed or cookies are blocked.
  if (!storedState || !codeVerifier) return fail('session_expired');

  if (!code || !state) return fail('auth_failed');

  if (state !== storedState) {
    console.error('Spotify callback state did not match the stored state.');
    return fail('state_mismatch');
  }

  try {
    const tokens = await exchangeCodeForTokens(code, codeVerifier);
    const profile = await getSpotifyUserProfile(tokens.access_token);

    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.spotifyId, profile.id));

    if (!user) {
      [user] = await db
        .insert(users)
        .values({
          spotifyId: profile.id,
          displayName: profile.display_name,
          email: profile.email,
          avatarUrl: profile.images?.[0]?.url,
        })
        .returning();
    } else {
      await db
        .update(users)
        .set({
          displayName: profile.display_name,
          email: profile.email,
          avatarUrl: profile.images?.[0]?.url,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    }

    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = encrypt(tokens.refresh_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const [existingAccount] = await db
      .select()
      .from(spotifyAccounts)
      .where(eq(spotifyAccounts.userId, user.id));

    if (existingAccount) {
      await db
        .update(spotifyAccounts)
        .set({
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt,
          scope: tokens.scope,
          updatedAt: new Date(),
        })
        .where(eq(spotifyAccounts.userId, user.id));
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
    clearHandshake();

    return redirectTo(next ?? DEFAULT_AFTER_LOGIN);
  } catch (err) {
    // Spotify answers 403 for accounts the app owner has not added while the
    // app is in Spotify's development mode. Everything else is a failure on
    // the way to a session; nothing was saved in either case.
    if (err instanceof SpotifyAuthRequestError && err.status === 403) {
      console.error('Spotify refused the account during sign-in (403).');
      return fail('user_not_registered');
    }
    console.error('Failed to handle Spotify callback:', err);
    return fail('token_exchange_failed');
  }
}
