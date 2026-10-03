import { getSession } from '@/lib/session';
import { spotifyService } from '@/lib/spotify-service';
import {
  isSpotifyReconnectError,
  SPOTIFY_RECONNECT_CODE,
  SPOTIFY_RECONNECT_MESSAGE,
} from '@/lib/spotify-tokens';
import { MusicQueryInputSchema } from '@/lib/validation/api-schemas';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = MusicQueryInputSchema.safeParse({
    type: searchParams.get('type') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    timeRange: searchParams.get('timeRange') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters.' }, { status: 400 });
  }

  const { type, limit, timeRange } = parsed.data;

  try {
    let data;
    switch (type) {
      case 'recent':
        data = await spotifyService.getRecentlyPlayed(session.userId, limit);
        break;
      case 'top-tracks':
        data = await spotifyService.getTopTracks(session.userId, timeRange, limit);
        break;
      case 'top-artists':
        data = await spotifyService.getTopArtists(session.userId, timeRange, limit);
        break;
      case 'saved-tracks':
        data = await spotifyService.getSavedTracks(session.userId, limit);
        break;
      case 'saved-albums':
        data = await spotifyService.getSavedAlbums(session.userId, limit);
        break;
      case 'playlists':
        data = await spotifyService.getUserPlaylists(session.userId, limit);
        break;
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    if (isSpotifyReconnectError(error)) {
      return NextResponse.json(
        { error: SPOTIFY_RECONNECT_MESSAGE, code: SPOTIFY_RECONNECT_CODE },
        { status: 401 }
      );
    }
    console.error(`Spotify API route error (${type}):`, error);
    return NextResponse.json({ error: 'Unable to load music library data.' }, { status: 500 });
  }
}
