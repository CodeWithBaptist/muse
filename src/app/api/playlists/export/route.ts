import { getSession } from '@/lib/session';
import { spotifyService } from '@/lib/spotify-service';
import { db } from '@/db';
import {
  playlists as playlistsTable,
  playlistTracks as playlistTracksTable,
} from '@/db/schema';
import { verifySameOrigin } from '@/lib/security/csrf';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import {
  getValidAccessToken,
  isSpotifyReconnectError,
  SPOTIFY_RECONNECT_CODE,
  SPOTIFY_RECONNECT_MESSAGE,
} from '@/lib/spotify-tokens';
import { PlaylistExportInputSchema } from '@/lib/validation/api-schemas';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const csrfError = verifySameOrigin(request);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimited = await enforceRateLimit(request, {
    scope: 'playlists:export',
    limit: 10,
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

  const parsed = PlaylistExportInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Valid playlist name and Spotify track URIs are required.' },
      { status: 400 }
    );
  }

  const { playlistId, name, description, trackUris, tracks } = parsed.data;

  try {
    const token = await getValidAccessToken(session.userId);
    const profile = await spotifyService.getProfile(session.userId);

    const createRes = await fetch(`https://api.spotify.com/v1/users/${profile.id}/playlists`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description: description || 'Created with MUSE',
        public: false,
      }),
    });

    if (!createRes.ok) {
      throw new Error(`Spotify playlist creation failed with status ${createRes.status}`);
    }

    const spotifyPlaylist = (await createRes.json()) as {
      id: string;
      external_urls?: { spotify?: string };
    };

    const addRes = await fetch(`https://api.spotify.com/v1/playlists/${spotifyPlaylist.id}/tracks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uris: trackUris.slice(0, 100),
      }),
    });

    if (!addRes.ok) {
      throw new Error(`Spotify playlist track addition failed with status ${addRes.status}`);
    }

    let savedPlaylistId = playlistId;
    if (playlistId) {
      const updated = await db
        .update(playlistsTable)
        .set({
          spotifyPlaylistId: spotifyPlaylist.id,
          name,
          description,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(playlistsTable.id, playlistId),
            eq(playlistsTable.userId, session.userId)
          )
        )
        .returning({ id: playlistsTable.id });

      if (updated.length === 0) {
        savedPlaylistId = undefined;
      }
    }

    if (!savedPlaylistId) {
      const [inserted] = await db
        .insert(playlistsTable)
        .values({
          userId: session.userId,
          spotifyPlaylistId: spotifyPlaylist.id,
          name,
          description,
        })
        .returning({ id: playlistsTable.id });

      savedPlaylistId = inserted?.id;

      if (savedPlaylistId && tracks && tracks.length > 0) {
        await db.insert(playlistTracksTable).values(
          tracks.map((track, index) => ({
            playlistId: savedPlaylistId!,
            spotifyTrackId: track.id.replace(/^spotify:track:/, ''),
            position: index,
            title: track.title,
            artist: track.artist,
            albumArtUrl: track.albumArtUrl ?? null,
            durationMs: track.durationMs,
          }))
        );
      }
    }

    return NextResponse.json({
      success: true,
      playlistId: savedPlaylistId ?? null,
      spotifyUrl:
        spotifyPlaylist.external_urls?.spotify ??
        `https://open.spotify.com/playlist/${spotifyPlaylist.id}`,
    });
  } catch (error: unknown) {
    if (isSpotifyReconnectError(error)) {
      return NextResponse.json(
        { error: SPOTIFY_RECONNECT_MESSAGE, code: SPOTIFY_RECONNECT_CODE },
        { status: 401 }
      );
    }
    console.error('Playlist Export Error:', error);
    return NextResponse.json({ error: 'Unable to export playlist to Spotify right now.' }, { status: 500 });
  }
}
