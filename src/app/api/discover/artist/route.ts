import { orchestrateArtistExploration } from '@/lib/ai/discover-engine';
import {
  ArtistExploreInputSchema,
  ArtistExplorationResponseSchema,
} from '@/lib/validation/api-schemas';
import { NextResponse } from 'next/server';
import { runDiscoverAction } from '../action-helpers';

export const runtime = 'nodejs';

/** Section 37. Four angles on one artist, all tracks resolved through Spotify. */
export async function POST(request: Request) {
  // The artist name is read before the shared helper runs so a malformed body
  // is rejected without spending a model call on it.
  let artist: string;
  try {
    const parsed = ArtistExploreInputSchema.parse(await request.clone().json());
    artist = parsed.artist;
  } catch {
    return NextResponse.json(
      { error: 'Pick an artist to explore.' },
      { status: 400 }
    );
  }

  return runDiscoverAction(
    request,
    {
      scope: 'ai:discover:artist',
      limit: 10,
      fallbackError: 'Unable to explore that artist right now.',
    },
    async (userId) => {
      const data = await orchestrateArtistExploration(userId, artist);
      return ArtistExplorationResponseSchema.parse(data);
    }
  );
}
