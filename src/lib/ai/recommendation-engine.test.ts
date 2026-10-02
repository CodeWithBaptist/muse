import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orchestrateRecommendations } from './recommendation-engine';
import { spotifyService } from '../spotify-service';
import * as aiProvider from './provider';

vi.mock('../spotify-service', () => ({
  spotifyService: {
    search: vi.fn(),
    getTopArtists: vi.fn(),
    getTopTracks: vi.fn(),
  },
}));

vi.mock('./provider', () => ({
  structuredCompletion: vi.fn(),
}));

describe('Recommendation Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('orchestrates search and explanations correctly', async () => {
    const userId = 'user-123';
    const userMessage = 'uplifting R&B';

    (aiProvider.structuredCompletion as any)
      .mockResolvedValueOnce({
        searchQueries: ['genre:rnb style:uplifting'],
        reasoning: 'Searching for upbeat R&B.',
      }) // Intent
      .mockResolvedValueOnce({
        explanations: [{ trackId: '1', reason: 'Great vibe.' }],
        intro: 'Here is some uplifting R&B.',
      }); // Explanation

    (spotifyService.search as any).mockResolvedValue({
      tracks: {
        items: [{ 
          id: '1', 
          name: 'Song 1', 
          artists: [{ name: 'Artist 1' }],
          album: { name: 'Album 1' }
        }],
      },
    });

    (spotifyService.getTopArtists as any).mockResolvedValue({ items: [] });
    (spotifyService.getTopTracks as any).mockResolvedValue({ items: [] });

    const result = await orchestrateRecommendations(userId, userMessage);

    expect(result.message).toBe('Here is some uplifting R&B.');
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].id).toBe('1');
    expect(result.tracks[0].reason).toBe('Great vibe.');
    expect(spotifyService.search).toHaveBeenCalledWith(userId, 'genre:rnb style:uplifting', ['track'], 8);
  });
});
