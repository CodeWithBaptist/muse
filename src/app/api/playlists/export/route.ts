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
  SpotifyReconnectError,
  SPOTIFY_RECONNECT_CODE,
  SPOTIFY_RECONNECT_MESSAGE,
} from '@/lib/spotify-tokens';
import { PlaylistExportInputSchema } from '@/lib/validation/api-schemas';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const ADD_CHUNK_SIZE = 25;

interface SpotifyPlaylistRef {
  id: string;
  external_urls?: { spotify?: string };
}

function playlistUrl(playlist: SpotifyPlaylistRef): string {
  return (
    playlist.external_urls?.spotify ??
    `https://open.spotify.com/playlist/${playlist.id}`
  );
}

/**
 * Adds one chunk of items and reports the HTTP status alongside success.
 *
 * Spotify's February 2026 Web API changes removed `POST /playlists/{id}/tracks`
 * in favour of `POST /playlists/{id}/items`. The request body is unchanged: a
 * JSON `uris` array, capped at 100 items per request, answered with 201 and a
 * `snapshot_id`. The scopes are the same two MUSE already requests.
 */
async function addTrackChunk(
  token: string,
  playlistId: string,
  uris: string[],
): Promise<{ ok: boolean; status: number }> {
  const response = await fetch(`${SPOTIFY_API}/playlists/${playlistId}/items`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uris }),
  });
  return { ok: response.ok, status: response.status };
}

/**
 * Statuses meaning the call itself cannot succeed.
 *
 * Retrying track by track after one of these would repeat the same failure for
 * every remaining track and then report all of them as rejected, blaming the
 * music for a problem with the request.
 */
const SYSTEMIC_ADD_STATUSES = new Set([401, 403, 404, 405, 429]);

class PlaylistItemsError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'PlaylistItemsError';
  }
}

function addItemsFailure(status: number): Error {
  if (status === 401) return new SpotifyReconnectError();

  if (status === 403) {
    return new PlaylistItemsError(
      status,
      'Spotify refused to change this playlist. It may not be editable with the permissions MUSE was granted.'
    );
  }

  if (status === 404 || status === 405) {
    return new PlaylistItemsError(
      status,
      'Spotify no longer serves that playlist endpoint, so MUSE cannot add these tracks.'
    );
  }

  if (status === 429) {
    return new PlaylistItemsError(
      status,
      'Spotify is rate limiting MUSE right now. Try again in a moment.'
    );
  }

  return new PlaylistItemsError(
    status,
    `Spotify rejected the request with status ${status}.`
  );
}

/**
 * Adds tracks and reports which ones Spotify refused, so the client can offer a
 * retry for only those tracks. A chunk that fails is retried track by track to
 * find the individual failures instead of blaming the whole batch.
 */
async function addTracksReportingFailures(
  token: string,
  playlistId: string,
  uris: string[],
): Promise<{ addedCount: number; failedTrackUris: string[] }> {
  const failedTrackUris: string[] = [];
  let addedCount = 0;

  for (let index = 0; index < uris.length; index += ADD_CHUNK_SIZE) {
    const chunk = uris.slice(index, index + ADD_CHUNK_SIZE);
    const chunkResult = await addTrackChunk(token, playlistId, chunk);

    if (chunkResult.ok) {
      addedCount += chunk.length;
      continue;
    }

    if (SYSTEMIC_ADD_STATUSES.has(chunkResult.status)) {
      throw addItemsFailure(chunkResult.status);
    }

    for (const uri of chunk) {
      const singleResult = await addTrackChunk(token, playlistId, [uri]);
      if (singleResult.ok) {
        addedCount += 1;
        continue;
      }
      if (SYSTEMIC_ADD_STATUSES.has(singleResult.status)) {
        throw addItemsFailure(singleResult.status);
      }
      failedTrackUris.push(uri);
    }
  }

  return { addedCount, failedTrackUris };
}

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

  const { playlistId, spotifyPlaylistId, name, description, trackUris, tracks } =
    parsed.data;

  try {
    const token = await getValidAccessToken(session.userId);

    let spotifyPlaylist: SpotifyPlaylistRef;
    let created = false;

    if (spotifyPlaylistId) {
      // Adding the tracks that previously failed to an existing playlist. The
      // playlist is verified first so an uneditable playlist is reported as a
      // failure instead of a false partial success.
      const profile = await spotifyService.getProfile(session.userId);
      const playlistRes = await fetch(
        `${SPOTIFY_API}/playlists/${spotifyPlaylistId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!playlistRes.ok) {
        throw new Error(
          `Spotify playlist lookup failed with status ${playlistRes.status}`
        );
      }

      const playlistMeta = (await playlistRes.json()) as SpotifyPlaylistRef & {
        owner?: { id?: string };
      };

      if (playlistMeta.owner?.id && playlistMeta.owner.id !== profile.id) {
        throw new Error(
          'Only a playlist owned by the connected Spotify account can be updated.'
        );
      }

      spotifyPlaylist = {
        id: playlistMeta.id,
        external_urls: playlistMeta.external_urls,
      };
    } else {
      // `POST /users/{id}/playlists` was removed in the same set of changes.
      // `POST /me/playlists` takes the identical body, which also removes the
      // need to look the profile up just to build the URL.
      const createRes = await fetch(`${SPOTIFY_API}/me/playlists`, {
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
        throw new Error(
          `Spotify playlist creation failed with status ${createRes.status}`
        );
      }

      spotifyPlaylist = (await createRes.json()) as SpotifyPlaylistRef;
      created = true;
    }

    const { addedCount, failedTrackUris } = await addTracksReportingFailures(
      token,
      spotifyPlaylist.id,
      trackUris.slice(0, 100)
    );

    let savedPlaylistId = playlistId;

    if (created) {
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
      } else {
        savedPlaylistId = undefined;
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
    }

    return NextResponse.json({
      success: true,
      playlistId: savedPlaylistId ?? null,
      spotifyPlaylistId: spotifyPlaylist.id,
      spotifyUrl: playlistUrl(spotifyPlaylist),
      created,
      requestedCount: trackUris.length,
      addedCount,
      failedTrackUris,
    });
  } catch (error: unknown) {
    if (isSpotifyReconnectError(error)) {
      return NextResponse.json(
        { error: SPOTIFY_RECONNECT_MESSAGE, code: SPOTIFY_RECONNECT_CODE },
        { status: 401 }
      );
    }
    if (error instanceof PlaylistItemsError) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'SPOTIFY_PLAYLIST_ITEMS_FAILED',
          spotifyStatus: error.status,
        },
        { status: 502 }
      );
    }

    console.error('Playlist Export Error:', error);
    return NextResponse.json(
      { error: 'Unable to export playlist to Spotify right now.' },
      { status: 500 }
    );
  }
}
