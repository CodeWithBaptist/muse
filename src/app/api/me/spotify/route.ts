import { db } from '@/db';
import { spotifyAccounts } from '@/db/schema';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { verifySameOrigin } from '@/lib/security/csrf';
import { deleteSession, getSession } from '@/lib/session';
import { deleteUserAccountData } from '@/lib/user-data';
import {
  SpotifyConnectionResponseSchema,
  SuccessResponseSchema,
} from '@/lib/validation/api-schemas';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimited = await enforceRateLimit(request, {
    scope: 'spotify:status',
    limit: 60,
    windowMs: 60_000,
    identifier: `user:${session.userId}`,
  });
  if (rateLimited) return rateLimited;

  try {
    const [account] = await db
      .select({ id: spotifyAccounts.id })
      .from(spotifyAccounts)
      .where(eq(spotifyAccounts.userId, session.userId))
      .limit(1);

    return NextResponse.json(
      SpotifyConnectionResponseSchema.parse({ connected: Boolean(account) }),
      { headers: { 'Cache-Control': 'no-store, private' } },
    );
  } catch {
    console.error('Spotify connection status request failed.');
    return NextResponse.json(
      { error: 'Unable to check Spotify connection status.' },
      { status: 500 },
    );
  }
}

/**
 * Disconnect Spotify.
 *
 * Spotify's Developer Policy requires deleting a user's personal data when they
 * disconnect, and MUSE's only user identity is the Spotify account it stores.
 * So disconnecting deletes the whole MUSE account rather than keeping a row with
 * the Spotify user ID, display name, email, and avatar behind. The user is
 * signed out and a later sign-in creates a fresh account.
 */
export async function DELETE(request: Request) {
  const csrfError = verifySameOrigin(request);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimited = await enforceRateLimit(request, {
    scope: 'spotify:disconnect',
    limit: 10,
    windowMs: 60_000,
    identifier: `user:${session.userId}`,
  });
  if (rateLimited) return rateLimited;

  try {
    await deleteUserAccountData(session.userId);
    await deleteSession();
    return NextResponse.json(SuccessResponseSchema.parse({ success: true }), {
      headers: { 'Cache-Control': 'no-store, private' },
    });
  } catch {
    console.error('Spotify disconnect request failed.');
    return NextResponse.json(
      { error: 'Unable to disconnect Spotify right now.' },
      { status: 500 },
    );
  }
}
