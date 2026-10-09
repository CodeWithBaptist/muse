// @vitest-environment jsdom
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { clearTasteSnapshot, getTasteSnapshot } from '@/lib/taste/store';
import { ProfileView } from './ProfileView';

const auth = vi.hoisted(() => ({ authenticated: false }));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    authenticated: auth.authenticated,
    user: null,
    isLoading: false,
    logout: async () => ({ ok: true }),
  }),
}));

const lastfmSnapshot = {
  source: 'lastfm',
  label: 'Last.fm: ada',
  sourceUrl: 'https://www.last.fm/user/ada',
  topArtists: [
    { name: 'Asake', plays: 312 },
    { name: 'Burna Boy', plays: 280 },
  ],
  topTracks: [{ title: 'Lonely At The Top', artist: 'Asake', plays: 40 }],
  recentTracks: [{ title: 'Last Last', artist: 'Burna Boy' }],
  capturedAt: '2024-03-01T00:00:00.000Z',
};

const insights = {
  identity: {
    dominantGenre: 'Afrobeats',
    tasteSummary: 'Lagos energy with room for a slow jam.',
    eraPreference: '2020s',
  },
  vibe: {
    inferredMood: 'Up',
    inferredEnergy: 'High',
    description: 'Inferred, not measured.',
  },
  discovery: {
    habit: 'Follows the artists.',
    recommendation: 'Try some Alte next.',
  },
};

function renderView(lastfmEnabled = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProfileView lastfmEnabled={lastfmEnabled} />
    </QueryClientProvider>,
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ProfileView', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    auth.authenticated = false;
    clearTasteSnapshot();
    window.localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('imports from Last.fm, keeps the snapshot on the device, writes the profile, and can forget it', async () => {
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/api/taste/lastfm'))
        return jsonResponse({ snapshot: lastfmSnapshot });
      if (url.endsWith('/api/taste/insights')) return jsonResponse(insights);
      throw new Error(`Unexpected fetch ${url}`);
    });
    renderView();

    expect(screen.queryByText(/Reconnect Spotify/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Last.fm username'), {
      target: { value: 'ada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Fetch listening' }));

    await screen.findByTestId('taste-snapshot');
    expect(getTasteSnapshot()?.label).toBe('Last.fm: ada');
    expect(screen.getByText('Asake')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Last.fm' })).toHaveAttribute(
      'href',
      'https://www.last.fm/user/ada',
    );

    await screen.findByTestId('insight-cards');
    expect(
      screen.getByText('Lagos energy with room for a slow jam.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Written from Last.fm: ada')).toBeInTheDocument();
    expect(screen.queryByText('Saved Preferences')).toBeNull();

    const insightsCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith('/api/taste/insights'),
    );
    expect(insightsCall).toBeDefined();
    const sent = JSON.parse((insightsCall![1] as RequestInit).body as string);
    expect(sent.snapshot.topArtists[0].name).toBe('Asake');

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove from this device' }),
    );
    expect(getTasteSnapshot()).toBeNull();
    expect(screen.queryByTestId('taste-snapshot')).toBeNull();
    expect(screen.queryByTestId('insight-cards')).toBeNull();
    expect(screen.getByTestId('lastfm-form')).toBeInTheDocument();
  });

  it('reads a Spotify export file on the device and never uploads it', async () => {
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/api/taste/insights')) return jsonResponse(insights);
      throw new Error(`Unexpected fetch ${url}`);
    });
    renderView(false);
    expect(screen.getByTestId('lastfm-off')).toBeInTheDocument();

    const history = JSON.stringify([
      {
        endTime: '2024-01-05 14:23',
        artistName: 'Asake',
        trackName: 'Lonely At The Top',
        msPlayed: 184000,
      },
      {
        endTime: '2024-01-06 09:00',
        artistName: 'Burna Boy',
        trackName: 'Last Last',
        msPlayed: 172000,
      },
    ]);
    const file = new File([history], 'StreamingHistory_music_0.json', {
      type: 'application/json',
    });
    const picker = screen.getByLabelText(
      'Spotify data export',
    ) as HTMLInputElement;
    Object.defineProperty(file, 'text', { value: async () => history });
    fireEvent.change(picker, { target: { files: [file] } });

    await screen.findByTestId('taste-snapshot');
    expect(screen.getByTestId('import-note')).toHaveTextContent(
      'Read 2 plays from 1 file, Jan 2024 to Jan 2024. Nothing was uploaded.',
    );
    expect(getTasteSnapshot()?.source).toBe('spotify_export');
    await screen.findByTestId('insight-cards');

    for (const [input, init] of fetchMock.mock.calls) {
      expect(String(input)).not.toContain('upload');
      const body = (init as RequestInit | undefined)?.body;
      expect(typeof body === 'string' ? body : '').not.toContain('endTime');
    }
  });

  it('says plainly when AI is not connected or MUSE is resting, and offers the account path only to testers', async () => {
    auth.authenticated = true;
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/api/taste/lastfm'))
        return jsonResponse({ snapshot: lastfmSnapshot });
      if (url.endsWith('/api/taste/insights')) {
        return jsonResponse(
          { error: 'MUSE is resting, try again soon.', code: 'AI_RESTING' },
          503,
        );
      }
      if (url.endsWith('/api/me/profile')) {
        return jsonResponse(
          {
            error: 'AI is not connected yet',
            code: 'AI_NOT_CONNECTED',
            aiConnected: false,
          },
          503,
        );
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    renderView();

    fireEvent.change(screen.getByLabelText('Last.fm username'), {
      target: { value: 'ada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Fetch listening' }));
    await screen.findByText('MUSE is resting, try again soon.');

    fireEvent.click(
      screen.getByRole('button', { name: 'Write from my Spotify' }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('ai-not-connected-state')).toBeInTheDocument(),
    );
    expect(screen.queryByText('MUSE is resting, try again soon.')).toBeNull();
  });
});
