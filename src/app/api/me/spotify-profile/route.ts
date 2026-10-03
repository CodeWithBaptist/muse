import { getSession } from '@/lib/session';
import { spotifyService } from '@/lib/spotify-service';
import {
  isSpotifyReconnectError,
  SPOTIFY_RECONNECT_CODE,
  SPOTIFY_RECONNECT_MESSAGE,
} from '@/lib/spotify-tokens';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await spotifyService.getProfile(session.userId);
    return NextResponse.json(data);
  } catch (error: unknown) {
    if (isSpotifyReconnectError(error)) {
      return NextResponse.json(
        { error: SPOTIFY_RECONNECT_MESSAGE, code: SPOTIFY_RECONNECT_CODE },
        { status: 401 }
      );
    }
    console.error('Spotify Profile API route error:', error);
    return NextResponse.json({ error: 'Unable to load Spotify profile.' }, { status: 500 });
  }
}
