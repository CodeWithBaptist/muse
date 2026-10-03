import { getSession } from '@/lib/session';
import { spotifyService } from '@/lib/spotify-service';
import {
  isSpotifyReconnectError,
  SPOTIFY_RECONNECT_CODE,
  SPOTIFY_RECONNECT_MESSAGE,
} from '@/lib/spotify-tokens';
import { MusicSearchQueryInputSchema } from '@/lib/validation/api-schemas';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = MusicSearchQueryInputSchema.safeParse({
    q: searchParams.get('q') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required and must be valid.' },
      { status: 400 }
    );
  }

  const { q, limit } = parsed.data;

  try {
    const data = await spotifyService.search(session.userId, q, ['track', 'artist'], limit);
    return NextResponse.json(data);
  } catch (error: unknown) {
    if (isSpotifyReconnectError(error)) {
      return NextResponse.json(
        { error: SPOTIFY_RECONNECT_MESSAGE, code: SPOTIFY_RECONNECT_CODE },
        { status: 401 }
      );
    }
    console.error('Spotify Search API route error:', error);
    return NextResponse.json({ error: 'Unable to complete search right now.' }, { status: 500 });
  }
}
