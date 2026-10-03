import { structuredCompletion } from './provider';
import { spotifyService } from '../spotify-service';
import type { SpotifyArtistSummary, SpotifyTrackItem } from '../validation/api-schemas';

interface DiscoverProposalSection {
  title: string;
  description: string;
  searchQueries: string[];
}

interface DiscoverProposal {
  sections: DiscoverProposalSection[];
}

const DiscoverSectionsSchema = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          searchQueries: { type: "array", items: { type: "string" } }
        },
        required: ["title", "description", "searchQueries"]
      }
    }
  },
  required: ["sections"]
};

export async function orchestrateDiscover(userId: string) {
  // 1. Fetch user context
  let userContext = "";
  try {
    const [topArtists, topTracks] = await Promise.all([
      spotifyService.getTopArtists(userId, 'medium_term', 10),
      spotifyService.getTopTracks(userId, 'medium_term', 10),
    ]);
    
    const artistItems = (topArtists?.items ?? []) as SpotifyArtistSummary[];
    const trackItems = (topTracks?.items ?? []) as SpotifyTrackItem[];
    const artistNames = artistItems.map((a) => a.name).join(', ');
    const trackNames = trackItems.map((t) => `${t.name} by ${t.artists[0]?.name ?? 'Unknown'}`).join(', ');
    userContext = `User likes: ${artistNames}. Favorite tracks: ${trackNames}.`;
  } catch (e) {
    console.warn("Discover: Failed to fetch user context", e);
  }

  // 2. Ask AI to propose Discover sections
  const prompt = `
    Based on the user's taste: ${userContext || "Unknown (new user)"}
    Propose 4-5 editorial music discovery sections for a "Discover" page.
    Sections should be:
    1. "Because you listen to [Artist/Genre]" (Related to current taste)
    2. "Outside your usual rotation" (Exploring adjacent genres)
    3. "Deep cuts" (Less popular tracks from artists they like)
    4. "New territory" (Completely different but potentially interesting genres)
    
    For each section, provide a short editorial description (1 sentence) and 2-3 specific Spotify search queries to find tracks.
    Return JSON format.
  `;

  const proposal = await structuredCompletion<DiscoverProposal>(
    prompt,
    DiscoverSectionsSchema,
    "You are an expert music editor for a premium streaming service."
  );

  // 3. Fetch data for each section
  const sections = await Promise.all(proposal.sections.map(async (sec) => {
    const pool: SpotifyTrackItem[] = [];
    const seenIds = new Set<string>();

    for (const query of sec.searchQueries) {
      try {
        const res = await spotifyService.search(userId, query, ['track'], 8);
        const items = (res?.tracks?.items ?? []) as SpotifyTrackItem[];
        for (const track of items) {
          if (!seenIds.has(track.id)) {
            seenIds.add(track.id);
            pool.push(track);
          }
        }
      } catch (e) {
        console.error(`Discover search failed for "${query}":`, e);
      }
    }

    return {
      title: sec.title,
      description: sec.description,
      tracks: pool.slice(0, 10)
    };
  }));

  return { sections };
}
