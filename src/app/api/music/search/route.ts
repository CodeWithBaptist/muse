import { getSession } from '@/lib/session';
import { spotifyService } from '@/lib/spotify-service';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  if (!q) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  try {
    const data = await spotifyService.search(session.userId, q, ['track', 'artist'], limit);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Spotify Search API route error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
