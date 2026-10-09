// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { SpotifyListExport } from './SpotifyListExport';
import type { ListedTrack } from '@/lib/catalogue/types';

const auth = vi.hoisted(() => ({ authenticated: false }));
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    authenticated: auth.authenticated,
    user: null,
    isLoading: false,
    logout: async () => ({ ok: true }),
  }),
}));

const tracks: ListedTrack[] = [
  {
    id: 'wizkid--essence',
    title: 'Essence',
    artist: 'Wizkid',
    why: 'Slow heat.',
    region: 'Nigeria',
  },
  {
    id: 'ayinla--oroki',
    title: 'Oroki Social Club',
    artist: 'Haruna Ishola',
    why: 'Apala.',
    region: 'Nigeria',
  },
];

describe('SpotifyListExport (testers only)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    auth.authenticated = false;
  });

  it('renders nothing at all for a visitor without an account', () => {
    const { container } = render(
      <SpotifyListExport title="Owambe" tracks={tracks} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('finds the songs first, reports the ones Spotify lacks, then creates the playlist and links it', async () => {
    auth.authenticated = true;
    const calls: Array<{ url: string; body: unknown }> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      calls.push({ url, body: JSON.parse(String(init?.body)) });
      if (url === '/api/playlists/resolve') {
        return new Response(
          JSON.stringify({
            resolved: [
              {
                id: 'wizkid--essence',
                uri: 'spotify:track:abc',
                spotifyId: 'abc',
                title: 'Essence (feat. Tems)',
                artist: 'Wizkid, Tems',
              },
            ],
            unresolved: ['ayinla--oroki'],
          }),
          { status: 200 },
        );
      }
      if (url === '/api/playlists/export') {
        return new Response(
          JSON.stringify({
            spotifyUrl: 'https://open.spotify.com/playlist/p1',
            spotifyPlaylistId: 'p1',
            created: true,
            requestedCount: 1,
            addedCount: 1,
            failedTrackUris: [],
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected ${url}`);
    });

    render(<SpotifyListExport title="Owambe" tracks={tracks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create in Spotify' }));

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('1 of 2 added'),
    );
    expect(screen.getByRole('status').textContent).toContain(
      'Not on Spotify: Oroki Social Club by Haruna Ishola',
    );
    expect(
      screen
        .getByRole('link', { name: 'Open the playlist on Spotify' })
        .getAttribute('href'),
    ).toBe('https://open.spotify.com/playlist/p1');
    expect(calls.map((c) => c.url)).toEqual([
      '/api/playlists/resolve',
      '/api/playlists/export',
    ]);
    expect(calls[1].body).toMatchObject({
      name: 'Owambe',
      trackUris: ['spotify:track:abc'],
    });
  });

  it('creates nothing and says so when no song can be found', async () => {
    auth.authenticated = true;
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ resolved: [], unresolved: tracks.map((t) => t.id) }),
          { status: 200 },
        ),
      );
    render(<SpotifyListExport title="Owambe" tracks={tracks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create in Spotify' }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        'no playlist was created',
      ),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
