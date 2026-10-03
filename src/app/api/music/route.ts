import { getSession } from '@/lib/session';
import { spotifyService } from '@/lib/spotify-service';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'recent';
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const timeRange = (searchParams.get('timeRange') as any) || 'medium_term';

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
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error(`Spotify API route error (${type}):`, error);
    return NextResponse.json({ error: 'Unable to load music library data.' }, { status: 500 });
  }
}
