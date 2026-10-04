import { describe, it, expect, vi } from 'vitest';
import { spotifyService } from './spotify-service';
import * as spotifyTokens from './spotify-tokens';

vi.mock('./spotify-tokens', () => ({
  getValidAccessToken: vi.fn(),
}));

global.fetch = vi.fn();

describe('Spotify Service', () => {
  it('fetches profile correctly', async () => {
    const userId = 'user-123';
    const mockToken = 'mock-token';
    const mockProfile = { id: 'spotify-id', display_name: 'Test User' };

    (spotifyTokens.getValidAccessToken as any).mockResolvedValue(mockToken);
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProfile),
    });

    const profile = await spotifyService.getProfile(userId);
    expect(profile).toEqual(mockProfile);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.spotify.com/v1/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockToken}`,
        }),
      }),
    );
  });

  it('does not expose Spotify audio preview URLs to the client', async () => {
    (spotifyTokens.getValidAccessToken as any).mockResolvedValue('token');
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          tracks: {
            items: [
              {
                id: '3n3Ppam7vgaVa1iaRUc9Lp',
                preview_url: 'https://p.scdn.co/mp3-preview/clip',
                album: {
                  name: 'A Seat at the Table',
                  preview_url: 'https://p.scdn.co/mp3-preview/album-clip',
                },
              },
            ],
          },
        }),
    });

    const result = await spotifyService.search('user-123', 'Solange', [
      'track',
    ]);
    expect(result).toEqual({
      tracks: {
        items: [
          {
            id: '3n3Ppam7vgaVa1iaRUc9Lp',
            album: { name: 'A Seat at the Table' },
          },
        ],
      },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/search?q=Solange&type=track&limit=10'),
      expect.any(Object),
    );
  });

  it('handles API errors correctly', async () => {
    const userId = 'user-123';
    (spotifyTokens.getValidAccessToken as any).mockResolvedValue('token');
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ message: 'Track not found' }),
    });

    await expect(spotifyService.getTrack(userId, 'invalid-id')).rejects.toThrow(
      'Spotify API error: Track not found',
    );
  });
});
