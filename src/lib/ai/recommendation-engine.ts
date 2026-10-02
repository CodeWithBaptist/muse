import { z } from 'zod';
import { structuredCompletion } from './provider';
import { spotifyService } from '../spotify-service';

const SearchIntentSchema = z.object({
  searchQueries: z.array(z.string()).describe('A list of specific search queries for Spotify (e.g. "genre:afrobeats year:2023", "artist:Brent Faiyaz style:smooth")'),
  mood: z.string().optional(),
  reasoning: z.string().describe('Internal reasoning for these queries'),
});

type SearchIntent = z.infer<typeof SearchIntentSchema>;

const ExplanationSchema = z.object({
  explanations: z.array(z.object({
    trackId: z.string(),
    reason: z.string(),
  })),
  intro: z.string(),
});

export async function orchestrateRecommendations(userId: string, userMessage: string) {
  // 0. Fetch user context for personalization (if available)
  let userContext = "";
  try {
    const [topArtists, topTracks] = await Promise.all([
      spotifyService.getTopArtists(userId, 'medium_term', 5),
      spotifyService.getTopTracks(userId, 'medium_term', 5),
    ]);
    
    const artistNames = topArtists.items.map((a: any) => a.name).join(', ');
    const trackNames = topTracks.items.map((t: any) => `${t.name} by ${t.artists[0].name}`).join(', ');
    userContext = `User's top artists: ${artistNames}. User's top tracks: ${trackNames}.`;
  } catch (e) {
    console.warn("Failed to fetch user context for recommendations", e);
  }

  // 1. Extract Intent & Propose Search Criteria
  const intentPrompt = `
    User Message: "${userMessage}"
    ${userContext ? `Context: ${userContext}` : ""}

    Your goal is to discover music for the user.
    Generate 5-8 specific and diverse Spotify search queries that cover different angles of the request:
    - Direct matches for mentioned artists or genres.
    - Related "vibe" matches (e.g., using "year:2020-2024" or "genre:alt-z").
    - "Discovery" matches (finding something slightly outside the usual).

    Return a JSON object with "searchQueries" (array of strings) and "reasoning".
  `;

  const intent = await structuredCompletion<SearchIntent>(
    intentPrompt,
    SearchIntentSchema,
    "You are MUSE, a music discovery specialist. You use advanced Spotify search operators (genre:, year:, label:, tag:new) to find perfect matches."
  );

  // 2. Execute Search & De-duplicate
  const pool: any[] = [];
  const seenIds = new Set<string>();

  // Parallel searches for efficiency
  const searchPromises = intent.searchQueries.map(query => 
    spotifyService.search(userId, query, ['track'], 8)
      .catch(e => {
        console.error(`Search failed for query "${query}":`, e);
        return { tracks: { items: [] } };
      })
  );

  const results = await Promise.all(searchPromises);

  for (const res of results) {
    if (res.tracks?.items) {
      for (const track of res.tracks.items) {
        if (!seenIds.has(track.id)) {
          seenIds.add(track.id);
          pool.push(track);
        }
      }
    }
  }

  if (pool.length === 0) {
    return {
      message: "I couldn't find any music matching that vibe. Try describing it in a different way?",
      tracks: [],
    };
  }

  // 3. AI Ranking and Selection
  // Limit pool size for AI processing
  const candidates = pool.slice(0, 25).map(t => ({
    id: t.id,
    title: t.name,
    artist: t.artists.map((a: any) => a.name).join(', '),
    album: t.album.name,
  }));

  const rankingPrompt = `
    User requested: "${userMessage}"
    Potential tracks found: ${JSON.stringify(candidates)}

    Task:
    1. Select the 6-10 tracks that best fit the request.
    2. Rank them by relevance.
    3. Provide a warm, expert intro for the selection.
    4. Provide a 1-sentence "Why this?" reason for each chosen track, focusing on its sonic fit or why it matches the request.

    Return JSON matching the schema: { explanations: [{ trackId, reason }], intro }
  `;

  const selection = await structuredCompletion<any>(
    rankingPrompt,
    ExplanationSchema,
    "You are MUSE, a premium music companion with impeccable taste. You prefer quality and cohesion over quantity."
  );

  // 4. Final Result Assembly
  const selectedTracks = selection.explanations
    .map((exp: any) => {
      const track = pool.find(t => t.id === exp.trackId);
      if (!track) return null;
      return {
        ...track,
        reason: exp.reason,
      };
    })
    .filter(Boolean);

  return {
    message: selection.intro || "Here's a curated selection based on your request:",
    tracks: selectedTracks.length > 0 ? selectedTracks : pool.slice(0, 8),
  };
}
