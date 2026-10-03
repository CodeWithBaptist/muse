import { getSession } from '@/lib/session';
import { db } from '@/db';
import {
  playlists as playlistsTable,
  playlistTracks as playlistTracksTable,
} from '@/db/schema';
import { verifySameOrigin } from '@/lib/security/csrf';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { PlaylistCreateDraftInputSchema } from '@/lib/validation/api-schemas';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userPlaylists = await db
      .select()
      .from(playlistsTable)
      .where(eq(playlistsTable.userId, session.userId))
      .orderBy(desc(playlistsTable.updatedAt));

    if (userPlaylists.length === 0) {
      return NextResponse.json({ playlists: [] });
    }

    const playlistIds = userPlaylists.map((p) => p.id);
    const allTracks = await db
      .select()
      .from(playlistTracksTable)
      .where(inArray(playlistTracksTable.playlistId, playlistIds))
      .orderBy(asc(playlistTracksTable.position));

    const tracksByPlaylist = new Map<string, typeof allTracks>();
    for (const track of allTracks) {
      const existing = tracksByPlaylist.get(track.playlistId) ?? [];
      existing.push(track);
      tracksByPlaylist.set(track.playlistId, existing);
    }

    const hydrated = userPlaylists.map((playlist) => ({
      ...playlist,
      spotifyUrl: playlist.spotifyPlaylistId
        ? `https://open.spotify.com/playlist/${playlist.spotifyPlaylistId}`
        : null,
      tracks: (tracksByPlaylist.get(playlist.id) ?? []).map((t) => ({
        id: t.spotifyTrackId,
        name: t.title,
        artists: [{ name: t.artist }],
        albumArtUrl: t.albumArtUrl ?? undefined,
        duration_ms: t.durationMs,
        uri: `spotify:track:${t.spotifyTrackId.replace(/^spotify:track:/, '')}`,
      })),
    }));

    return NextResponse.json({ playlists: hydrated });
  } catch (error: unknown) {
    console.error('Playlists GET error:', error);
    return NextResponse.json(
      { error: 'Unable to load saved playlists.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const csrfError = verifySameOrigin(request);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimited = await enforceRateLimit(request, {
    scope: 'playlists:create',
    limit: 20,
    windowMs: 60_000,
    identifier: `user:${session.userId}`,
  });
  if (rateLimited) return rateLimited;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = PlaylistCreateDraftInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Valid playlist name and tracks are required.' },
      { status: 400 }
    );
  }

  const { name, description, tracks } = parsed.data;

  try {
    const [created] = await db
      .insert(playlistsTable)
      .values({
        userId: session.userId,
        name,
        description: description || 'Created with MUSE',
      })
      .returning();

    if (tracks.length > 0) {
      await db.insert(playlistTracksTable).values(
        tracks.map((track, index) => ({
          playlistId: created.id,
          spotifyTrackId: track.id.replace(/^spotify:track:/, ''),
          position: index,
          title: track.title,
          artist: track.artist,
          albumArtUrl: track.albumArtUrl ?? null,
          durationMs: track.durationMs,
        }))
      );
    }

    return NextResponse.json({
      playlist: {
        ...created,
        spotifyUrl: null,
        tracks: tracks.map((t) => ({
          id: t.id.replace(/^spotify:track:/, ''),
          name: t.title,
          artists: [{ name: t.artist }],
          albumArtUrl: t.albumArtUrl ?? undefined,
          duration_ms: t.durationMs,
          uri: `spotify:track:${t.id.replace(/^spotify:track:/, '')}`,
        })),
      },
    });
  } catch (error: unknown) {
    console.error('Playlists POST error:', error);
    return NextResponse.json(
      { error: 'Unable to save playlist right now.' },
      { status: 500 }
    );
  }
}
