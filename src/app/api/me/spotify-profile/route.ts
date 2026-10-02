import { getSession } from '@/lib/session';
import { spotifyService } from '@/lib/spotify-service';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await spotifyService.getProfile(session.userId);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Spotify Profile API route error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
