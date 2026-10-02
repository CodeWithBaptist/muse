import { getSession } from '@/lib/session';
import { spotifyService } from '@/lib/spotify-service';
import { db } from '@/db';
import { playlists as playlistsTable, playlistTracks } from '@/db/schema';
import { NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/spotify-tokens';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, description, trackUris } = await request.json();

    if (!name || !trackUris || !Array.isArray(trackUris)) {
      return NextResponse.json({ error: 'Name and track URIs are required' }, { status: 400 });
    }

    const token = await getValidAccessToken(session.userId);
    const profile = await spotifyService.getProfile(session.userId);

    // 1. Create Playlist on Spotify
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
      const error = await createRes.json();
      throw new Error(`Failed to create Spotify playlist: ${error.message || createRes.statusText}`);
    }

    const spotifyPlaylist = await createRes.json();

    // 2. Add Tracks to Spotify Playlist
    // Spotify allows up to 100 tracks per request
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
      const error = await addRes.json();
      throw new Error(`Failed to add tracks to Spotify playlist: ${error.message || addRes.statusText}`);
    }

    // 3. Save to local DB
    const [dbPlaylist] = await db.insert(playlistsTable).values({
      userId: session.userId,
      spotifyPlaylistId: spotifyPlaylist.id,
      name,
      description,
    }).returning();

    return NextResponse.json({
      success: true,
      playlistId: dbPlaylist.id,
      spotifyUrl: spotifyPlaylist.external_urls.spotify,
    });

  } catch (error: any) {
    console.error('Playlist Export Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
