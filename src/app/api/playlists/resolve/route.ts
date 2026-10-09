import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { spotifyService } from '@/lib/spotify-service';
import { verifySameOrigin } from '@/lib/security/csrf';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import {
  isSpotifyReconnectError,
  SPOTIFY_RECONNECT_CODE,
  SPOTIFY_RECONNECT_MESSAGE,
} from '@/lib/spotify-tokens';
import { artistMatches, titleMatches } from '@/lib/catalogue/normalise';

export const runtime = 'nodejs';

/**
 * Tester-only: turns a MUSE list (titles and artists) into Spotify track
 * URIs for the signed-in tester's own account, so the existing export can
 * create the playlist. Each song is searched with Spotify's field filters
 * and accepted only when the title and an artist match; everything else
 * is reported as unresolved rather than guessed. Never on the open path.
 */

const InputSchema = z.object({
  tracks: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        title: z.string().trim().min(1).max(200),
        artist: z.string().trim().min(1).max(200),
      }),
    )
    .min(1)
    .max(20),
});

interface SpotifySearchTrack {
  id: string;
  uri: string;
  name: string;
  artists?: { name: string }[];
  album?: { name?: string; images?: { url: string }[] };
  duration_ms?: number;
}

export interface ResolvedTrack {
  id: string;
  uri: string;
  spotifyId: string;
  title: string;
  artist: string;
  albumArtUrl?: string | null;
  durationMs?: number;
}

function clean(value: string): string {
  return value.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function resolveOne(
  userId: string,
  track: { id: string; title: string; artist: string },
): Promise<ResolvedTrack | null> {
  const queries = [
    `track:"${clean(track.title)}" artist:"${clean(track.artist)}"`,
    `${clean(track.artist)} ${clean(track.title)}`,
  ];
  for (const query of queries) {
    const result = (await spotifyService.search(
      userId,
      query,
      ['track'],
      5,
    )) as {
      tracks?: { items?: SpotifySearchTrack[] };
    };
    const items = result.tracks?.items ?? [];
    const hit = items.find((item) => {
      const artistNames = (item.artists ?? []).map((a) => a.name).join(', ');
      return (
        titleMatches(track.title, item.name) &&
        artistMatches(track.artist, artistNames, item.name)
      );
    });
    if (hit) {
      return {
        id: track.id,
        uri: hit.uri,
        spotifyId: hit.id,
        title: hit.name,
        artist: (hit.artists ?? []).map((a) => a.name).join(', '),
        albumArtUrl: hit.album?.images?.at(-1)?.url ?? null,
        durationMs: hit.duration_ms,
      };
    }
  }
  return null;
}

export async function POST(request: Request) {
  const csrfError = verifySameOrigin(request);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimited = await enforceRateLimit(request, {
    scope: 'playlists:resolve',
    limit: 10,
    windowMs: 60_000,
    identifier: `user:${session.userId}`,
  });
  if (rateLimited) return rateLimited;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 },
    );
  }
  const parsed = InputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'A list of songs with titles and artists is required.' },
      { status: 400 },
    );
  }

  try {
    const outcomes = await Promise.all(
      parsed.data.tracks.map(async (track) => {
        try {
          return await resolveOne(session.userId, track);
        } catch (error) {
          if (isSpotifyReconnectError(error)) throw error;
          console.warn(
            'Spotify search failed while resolving a song:',
            error instanceof Error ? error.message : error,
          );
          return null;
        }
      }),
    );
    const resolved = outcomes.filter(
      (item): item is ResolvedTrack => item !== null,
    );
    const unresolved = parsed.data.tracks
      .filter((track) => !resolved.some((item) => item.id === track.id))
      .map((track) => track.id);
    return NextResponse.json({ resolved, unresolved });
  } catch (error) {
    if (isSpotifyReconnectError(error)) {
      return NextResponse.json(
        { error: SPOTIFY_RECONNECT_MESSAGE, code: SPOTIFY_RECONNECT_CODE },
        { status: 401 },
      );
    }
    console.error('Resolve failed:', error);
    return NextResponse.json(
      { error: 'Spotify could not be reached right now.' },
      { status: 502 },
    );
  }
}
