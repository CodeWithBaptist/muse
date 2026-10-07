import { getSession } from '@/lib/session';
import { db } from '@/db';
import {
  playlists as playlistsTable,
  playlistTracks as playlistTracksTable,
} from '@/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { verifySameOrigin } from '@/lib/security/csrf';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import {
  PlaylistEvolveInputSchema,
  PlaylistIdParamSchema,
} from '@/lib/validation/api-schemas';
import { orchestratePlaylistEvolution } from '@/lib/ai/playlist-evolution';
import {
  AI_NOT_CONNECTED_CODE,
  AI_NOT_CONNECTED_MESSAGE,
  isAIConfigured,
  isAINotConnectedError,
} from '@/lib/ai/provider';
import {
  isSpotifyReconnectError,
  SPOTIFY_RECONNECT_CODE,
  SPOTIFY_RECONNECT_MESSAGE,
} from '@/lib/spotify-tokens';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Section 34. Proposes an evolution of a playlist and returns a preview.
 *
 * This handler performs no writes at all, to MUSE or to Spotify. That is the
 * whole point of splitting it from the confirm handler: a preview cannot change
 * anything, so "nothing changes in Spotify until the user explicitly confirms"
 * is guaranteed by what this code is able to do rather than by what it chooses
 * not to do.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = verifySameOrigin(request);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimited = await enforceRateLimit(request, {
    scope: 'playlists:evolve',
    limit: 10,
    windowMs: 60_000,
    identifier: `user:${session.userId}`,
  });
  if (rateLimited) return rateLimited;

  if (!isAIConfigured()) {
    return NextResponse.json(
      {
        error: AI_NOT_CONNECTED_MESSAGE,
        code: AI_NOT_CONNECTED_CODE,
        aiConnected: false,
      },
      { status: 503 }
    );
  }

  const resolvedParams = await params;
  const parsedParams = PlaylistIdParamSchema.safeParse(resolvedParams);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid playlist ID.' }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsedBody = PlaylistEvolveInputSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Choose one of the evolution options.' },
      { status: 400 }
    );
  }

  const { id } = parsedParams.data;
  const { intent } = parsedBody.data;

  try {
    const [playlist] = await db
      .select()
      .from(playlistsTable)
      .where(
        and(eq(playlistsTable.id, id), eq(playlistsTable.userId, session.userId))
      );

    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }

    const existing = await db
      .select()
      .from(playlistTracksTable)
      .where(eq(playlistTracksTable.playlistId, id))
      .orderBy(asc(playlistTracksTable.position));

    const preview = await orchestratePlaylistEvolution(session.userId, {
      playlistName: playlist.name,
      existingTracks: existing.map((track) => ({
        title: track.title,
        artist: track.artist,
      })),
      intent,
    });

    return NextResponse.json({
      playlistId: id,
      existingTrackCount: existing.length,
      preview,
    });
  } catch (error: unknown) {
    if (isAINotConnectedError(error)) {
      return NextResponse.json(
        {
          error: AI_NOT_CONNECTED_MESSAGE,
          code: AI_NOT_CONNECTED_CODE,
          aiConnected: false,
        },
        { status: 503 }
      );
    }
    if (isSpotifyReconnectError(error)) {
      return NextResponse.json(
        { error: SPOTIFY_RECONNECT_MESSAGE, code: SPOTIFY_RECONNECT_CODE },
        { status: 401 }
      );
    }
    console.error('Playlist evolve error:', error);
    return NextResponse.json(
      { error: 'Unable to plan changes to this playlist right now.' },
      { status: 500 }
    );
  }
}
