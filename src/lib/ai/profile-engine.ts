import { structuredCompletion } from './provider';
import { spotifyService } from '../spotify-service';

const ProfileInsightsSchema = {
  type: "object",
  properties: {
    identity: {
      type: "object",
      properties: {
        dominantGenre: { type: "string" },
        tasteSummary: { type: "string" },
        eraPreference: { type: "string" }
      },
      required: ["dominantGenre", "tasteSummary", "eraPreference"]
    },
    vibe: {
      type: "object",
      properties: {
        inferredMood: { type: "string" },
        inferredEnergy: { type: "string" },
        description: { type: "string" }
      },
      required: ["inferredMood", "inferredEnergy", "description"]
    },
    discovery: {
      type: "object",
      properties: {
        habit: { type: "string" },
        recommendation: { type: "string" }
      },
      required: ["habit", "recommendation"]
    }
  },
  required: ["identity", "vibe", "discovery"]
};

export async function orchestrateProfileInsights(userId: string) {
  // 1. Fetch user data
  let dataContext = "";
  try {
    const [topArtists, topTracks, recentlyPlayed] = await Promise.all([
      spotifyService.getTopArtists(userId, 'long_term', 10),
      spotifyService.getTopTracks(userId, 'long_term', 10),
      spotifyService.getRecentlyPlayed(userId, 10)
    ]);
    
    const artists = topArtists.items.map((a: any) => `${a.name} (${a.genres.join(', ')})`).join('; ');
    const tracks = topTracks.items.map((t: any) => `${t.name} by ${t.artists[0].name}`).join('; ');
    const recent = recentlyPlayed.items.map((i: any) => i.track.name).join('; ');
    
    dataContext = `Top Artists: ${artists}. Top Tracks: ${tracks}. Recently Played: ${recent}.`;
  } catch (e) {
    console.warn("Profile: Failed to fetch user data context", e);
  }

  // 2. Ask AI to generate human-readable insights
  const prompt = `
    Based on the following music data: ${dataContext || "New user (no data yet)"}
    
    Provide human-readable insights into the user's musical identity.
    - Identity: What's their core sound? What era do they love?
    - Vibe: Infer their current mood and energy level based on recent and top tracks. Label these clearly as inferred.
    - Discovery: How do they discover music? What's one recommendation for their discovery path?
    
    Keep the descriptions short, expert, and warm. Avoid generic praise.
    Return JSON format.
  `;

  const insights = await structuredCompletion<any>(
    prompt,
    ProfileInsightsSchema,
    "You are a musicologist and taste analyst."
  );

  return insights;
}
