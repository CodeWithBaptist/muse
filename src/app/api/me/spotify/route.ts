import { db } from '@/db';
import {
  conversations,
  musicProfiles,
  playlistTracks,
  playlists,
  recommendations,
  spotifyAccounts,
} from '@/db/schema';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { verifySameOrigin } from '@/lib/security/csrf';
import { getSession } from '@/lib/session';
import {
  SpotifyConnectionResponseSchema,
  SuccessResponseSchema,
} from '@/lib/validation/api-schemas';
import { eq, inArray } from 'drizzle-orm';
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
    await db.transaction(async (transaction) => {
      const userPlaylists = await transaction
        .select({ id: playlists.id })
        .from(playlists)
        .where(eq(playlists.userId, session.userId));

      await transaction
        .delete(recommendations)
        .where(eq(recommendations.userId, session.userId));
      await transaction
        .delete(musicProfiles)
        .where(eq(musicProfiles.userId, session.userId));
      await transaction
        .delete(conversations)
        .where(eq(conversations.userId, session.userId));

      if (userPlaylists.length > 0) {
        await transaction.delete(playlistTracks).where(
          inArray(
            playlistTracks.playlistId,
            userPlaylists.map(({ id }) => id),
          ),
        );
        await transaction
          .delete(playlists)
          .where(eq(playlists.userId, session.userId));
      }

      await transaction
        .delete(spotifyAccounts)
        .where(eq(spotifyAccounts.userId, session.userId));
    });
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
