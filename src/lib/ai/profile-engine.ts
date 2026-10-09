import { sanitizePromptInput } from './provider';
import { spotifyService } from '../spotify-service';
import {
  type ProfileInsightsData,
  type SpotifyArtistSummary,
  type SpotifyTrackItem,
} from '../validation/api-schemas';
import { formatUserMemoryContext, getUserMemoryForPrompt } from './user-memory';
import { writeTasteInsights } from './taste-insights';

/** The written profile for a signed-in tester from the Spotify account they connected. */
export async function orchestrateProfileInsights(userId: string): Promise<ProfileInsightsData> {
  // 1. Fetch user data
  let dataContext = '';
  try {
    const [topArtists, topTracks, recentlyPlayed] = await Promise.all([
      spotifyService.getTopArtists(userId, 'long_term', 10),
      spotifyService.getTopTracks(userId, 'long_term', 10),
      spotifyService.getRecentlyPlayed(userId, 10),
    ]);

    const artistItems = (topArtists?.items ?? []) as SpotifyArtistSummary[];
    const trackItems = (topTracks?.items ?? []) as SpotifyTrackItem[];
    const recentItems = (recentlyPlayed?.items ?? []) as Array<{ track: SpotifyTrackItem }>;

    const artists = artistItems
      .slice(0, 10)
      .map((a) => sanitizePromptInput(`${a.name} (${(a.genres ?? []).join(', ')})`, 100))
      .join('; ');
    const tracks = trackItems
      .slice(0, 10)
      .map((t) => sanitizePromptInput(`${t.name} by ${t.artists[0]?.name ?? 'Unknown'}`, 80))
      .join('; ');
    const recent = recentItems
      .slice(0, 10)
      .map((i) => sanitizePromptInput(i.track.name, 60))
      .join('; ');

    dataContext = `Top Artists: ${artists}. Top Tracks: ${tracks}. Recently Played: ${recent}.`;
  } catch (e) {
    console.warn('Profile: Failed to fetch user data context', e);
  }

  const memoryContext = formatUserMemoryContext(
    await getUserMemoryForPrompt(userId),
  );

  return writeTasteInsights({ listening: dataContext, memory: memoryContext });
}
