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
  PlaylistEvolveConfirmInputSchema,
  PlaylistIdParamSchema,
} from '@/lib/validation/api-schemas';
import { SpotifyCandidateTrackSchema } from '@/lib/ai/recommendation-engine';
import { spotifyService } from '@/lib/spotify-service';
import { addItemsToSpotifyPlaylist } from '@/lib/spotify-playlist-items';
import { getValidAccessToken } from '@/lib/spotify-tokens';
import type { SpotifyTrackItem } from '@/lib/validation/api-schemas';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Section 34. Applies an evolution the visitor has explicitly confirmed.
 *
 * Track ids arrive from the client, so each one is resolved through Spotify
 * again and the metadata Spotify returns is what gets stored. A crafted request
 * cannot put unverified titles or artists into a playlist this way, which is
 * what section 29 requires of anything MUSE displays.
 *
 * The MUSE side is written first. Adding to Spotify is attempted only when the
 * playlist actually exists there, and a refusal from Spotify is reported as
 * such instead of being folded into a success, because the two can genuinely
 * disagree.
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
    scope: 'playlists:evolve:confirm',
    limit: 10,
    windowMs: 60_000,
    identifier: `user:${session.userId}`,
  });
  if (rateLimited) return rateLimited;

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

  const parsedBody = PlaylistEvolveConfirmInputSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Choose at least one track to add.' },
      { status: 400 }
    );
  }

  const { id } = parsedParams.data;
  const { trackIds } = parsedBody.data;

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

    const existingIds = new Set(
      existing.map((track) => track.spotifyTrackId.replace(/^spotify:track:/, ''))
    );
    let nextPosition = existing.length;

    const verified: SpotifyTrackItem[] = [];
    const unresolved: string[] = [];

    for (const rawId of trackIds) {
      const trackId = rawId.replace(/^spotify:track:/, '');
      if (existingIds.has(trackId)) continue;

      const response = await spotifyService.getTrack(session.userId, trackId);
      const parsed = SpotifyCandidateTrackSchema.safeParse(response);
      if (!parsed.success) {
        unresolved.push(trackId);
        continue;
      }

      const track = parsed.data as SpotifyTrackItem;
      existingIds.add(trackId);

      await db.insert(playlistTracksTable).values({
        playlistId: id,
        spotifyTrackId: trackId,
        position: nextPosition,
        title: track.name,
        artist: track.artists.map((artist) => artist.name).join(', '),
        albumArtUrl: track.album?.images?.[0]?.url ?? null,
        durationMs: track.duration_ms ?? 0,
      });

      nextPosition += 1;
      verified.push(track);
    }

    await db
      .update(playlistsTable)
      .set({ updatedAt: new Date() })
      .where(eq(playlistsTable.id, id));

    // Only a playlist that exists in Spotify can be changed there. A MUSE
    // draft has nowhere to write to, and inventing a result would be a lie.
    let spotifyUpdated = false;
    let spotifyStatus: number | null = null;

    if (playlist.spotifyPlaylistId && verified.length > 0) {
      const token = await getValidAccessToken(session.userId);
      const result = await addItemsToSpotifyPlaylist(
        token,
        playlist.spotifyPlaylistId,
        verified.map((track) => `spotify:track:${track.id}`)
      );
      spotifyUpdated = result.ok;
      spotifyStatus = result.status;
    }

    return NextResponse.json({
      playlistId: id,
      addedCount: verified.length,
      addedTracks: verified,
      unresolvedTrackIds: unresolved,
      spotifyUpdated,
      spotifyStatus,
      inSpotify: Boolean(playlist.spotifyPlaylistId),
    });
  } catch (error: unknown) {
    console.error('Playlist evolve confirm error:', error);
    return NextResponse.json(
      { error: 'Unable to update this playlist right now.' },
      { status: 500 }
    );
  }
}
