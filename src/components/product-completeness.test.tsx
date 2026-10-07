import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NowPlayingProvider } from '@/hooks/use-now-playing';
import { TrackRow } from '@/components/chat/TrackRow';
import { PlaylistPreview } from '@/components/chat/PlaylistPreview';
import { NowPlaying } from '@/components/shell/NowPlaying';
import PlaylistsPage from '@/app/(app)/playlists/page';
import SettingsPage from '@/app/(app)/settings/page';
import { Footer } from '@/components/landing/LandingSections';
import { MemoryManager } from '@/components/settings/MemoryManager';

function stripMotionProps(props: Record<string, unknown>) {
  const {
    initial,
    animate,
    exit,
    variants,
    transition,
    whileHover,
    whileTap,
    whileInView,
    viewport,
    layoutId,
    ...domProps
  } = props;
  void initial;
  void animate;
  void exit;
  void variants;
  void transition;
  void whileHover;
  void whileTap;
  void whileInView;
  void viewport;
  void layoutId;
  return domProps;
}

vi.mock('motion/react', () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...stripMotionProps(props)}>{children}</div>
    ),
    h1: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <h1 {...stripMotionProps(props)}>{children}</h1>
    ),
    p: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <p {...stripMotionProps(props)}>{children}</p>
    ),
    button: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <button {...stripMotionProps(props)}>{children}</button>
    ),
    span: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <span {...stripMotionProps(props)}>{children}</span>
    ),
    img: (props: Record<string, unknown>) => (
      <div
        role="img"
        aria-label={typeof props.alt === 'string' ? props.alt : ''}
      />
    )
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  MotionConfig: ({ children }: React.PropsWithChildren) => <>{children}</>,
  useReducedMotion: () => false
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NowPlayingProvider>{ui}</NowPlayingProvider>
    </QueryClientProvider>
  );
}

describe('Stage E: Product Completeness', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('toggles interactive Why this reasoning and selects track into NowPlaying inspector', () => {
    const sampleTrack = {
      id: '3n3Ppam7vgaVa1iaRUc9Lp',
      name: 'Midnight Signal',
      artists: [{ name: 'Solange' }],
      duration_ms: 215000,
      reason: 'Warm analog synth bassline that fits your late-night R&B prompt.'
    };

    renderWithProviders(
      <div>
        <TrackRow track={sampleTrack} index={0} />
        <NowPlaying />
      </div>
    );

    expect(screen.queryByTestId('why-this-panel')).toBeNull();
    expect(
      screen.queryByRole('button', { name: /play midnight signal/i })
    ).toBeNull();

    fireEvent.click(screen.getByTestId('why-this-toggle'));
    expect(screen.getByTestId('why-this-panel').textContent).toContain(
      'Warm analog synth bassline that fits your late-night R&B prompt.'
    );

    fireEvent.click(screen.getByText('Midnight Signal'));
    const panel = screen.getByTestId('now-playing-panel');
    expect(panel.textContent).toContain('Selected Track');
    expect(panel.textContent).toContain('Midnight Signal');
    expect(panel.textContent).toContain('Open in Spotify');
  });

  it('allows editing playlist title, removing tracks, and exporting to Spotify in PlaylistPreview', async () => {
    const exportBodies: Array<Record<string, unknown>> = [];

    vi.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/playlists/export' && init?.method === 'POST') {
        const parsed = JSON.parse(String(init.body));
        exportBodies.push(parsed);
        return new Response(
          JSON.stringify({
            success: true,
            spotifyUrl:
              'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 200 });
    });

    function StatefulPlaylistWrapper() {
      const [tracks, setTracks] = React.useState([
        {
          id: '3n3Ppam7vgaVa1iaRUc9Lp',
          name: 'Cranes in the Sky',
          artists: [{ name: 'Solange' }],
          uri: 'spotify:track:3n3Ppam7vgaVa1iaRUc9Lp'
        },
        {
          id: '4uLU6hMCjMI75M1A2tKUQC',
          name: 'Stay Flo',
          artists: [{ name: 'Solange' }],
          uri: 'spotify:track:4uLU6hMCjMI75M1A2tKUQC'
        }
      ]);

      return (
        <PlaylistPreview
          tracks={tracks}
          onRemoveTrack={(id) =>
            setTracks((prev) => prev.filter((t) => t.id !== id))
          }
          suggestedName="Initial Mix"
        />
      );
    }

    renderWithProviders(<StatefulPlaylistWrapper />);

    const nameInput = screen.getByLabelText(
      'Playlist Name'
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Edited Late Night Mix' } });
    expect(nameInput.value).toBe('Edited Late Night Mix');

    fireEvent.click(screen.getByLabelText('Remove Stay Flo'));
    // The row collapses out rather than vanishing, so it leaves the tree once
    // the exit transition finishes instead of on the same tick. The underlying
    // data is already gone, which is what the export assertion below checks.
    await waitFor(() => expect(screen.queryByText('Stay Flo')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /create in spotify/i }));

    await waitFor(() => {
      expect(exportBodies.length).toBe(1);
    });

    expect(exportBodies[0].name).toBe('Edited Late Night Mix');
    expect(exportBodies[0].trackUris).toEqual([
      'spotify:track:3n3Ppam7vgaVa1iaRUc9Lp'
    ]);
  });

  it('loads saved MUSE playlists on /playlists and supports editing and track removal', async () => {
    const patchCalls: Array<Record<string, unknown>> = [];

    vi.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/playlists') {
        return new Response(
          JSON.stringify({
            playlists: [
              {
                id: '11111111-1111-4111-8111-111111111111',
                name: 'Warm Analog Focus',
                description: 'Curated in Chat',
                spotifyPlaylistId: null,
                spotifyUrl: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                tracks: [
                  {
                    id: '3n3Ppam7vgaVa1iaRUc9Lp',
                    name: 'Track One',
                    artists: [{ name: 'Artist A' }],
                    uri: 'spotify:track:3n3Ppam7vgaVa1iaRUc9Lp'
                  }
                ]
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (
        url === '/api/playlists/11111111-1111-4111-8111-111111111111' &&
        init?.method === 'PATCH'
      ) {
        patchCalls.push(JSON.parse(String(init.body)));
        return new Response(
          JSON.stringify({
            playlist: {
              id: '11111111-1111-4111-8111-111111111111',
              name: 'Updated Title'
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.startsWith('/api/music?type=playlists')) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response('{}', { status: 200 });
    });

    renderWithProviders(<PlaylistsPage />);

    await waitFor(() => {
      expect(screen.getByText('Warm Analog Focus')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const editInput = screen.getByLabelText(
      'Edit playlist name'
    ) as HTMLInputElement;
    fireEvent.change(editInput, { target: { value: 'Updated Title' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(patchCalls.length).toBe(1);
    });
    expect(patchCalls[0].name).toBe('Updated Title');
  });

  it('saves recommendation and playback preferences and clears conversation history on /settings', async () => {
    const savedPayloads: Array<Record<string, unknown>> = [];
    let clearedHistory = false;

    vi.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (
        url === '/api/me/spotify' &&
        (!init?.method || init.method === 'GET')
      ) {
        return new Response(JSON.stringify({ connected: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url === '/api/playback/status') {
        return new Response(JSON.stringify({ availability: 'disconnected' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url === '/api/memory' && (!init?.method || init.method === 'GET')) {
        return new Response(JSON.stringify({ memories: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url === '/api/ai/status') {
        return new Response(
          JSON.stringify({
            connected: true,
            code: 'AI_CONNECTED',
            message: 'AI is connected.'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url === '/api/preferences' && (!init || init.method === 'GET')) {
        return new Response(
          JSON.stringify({
            discoveryStyle: 'balanced',
            playlistLength: '15',
            explicitContent: 'allow',
            favoriteGenres: 'neo-soul',
            playbackPreference: 'muse',
            updatedAt: null
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url === '/api/preferences' && init?.method === 'PUT') {
        const parsed = JSON.parse(String(init.body));
        savedPayloads.push(parsed);
        return new Response(
          JSON.stringify({
            ...parsed,
            updatedAt: new Date().toISOString()
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url === '/api/chat' && init?.method === 'DELETE') {
        clearedHistory = true;
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('{}', { status: 200 });
    });

    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(
        (
          screen.getByLabelText(
            'Priority Genres or Artists'
          ) as HTMLInputElement
        ).value
      ).toBe('neo-soul');
      expect(
        screen.getByText('No structured preferences are saved yet.')
      ).toBeDefined();
    });
    expect(screen.getByText('Spotify policy review needed')).toBeDefined();
    expect(
      screen
        .getByRole('link', { name: /read spotify developer policy/i })
        .getAttribute('href')
    ).toBe('https://developer.spotify.com/policy');

    fireEvent.click(screen.getByText('Deep cuts'));
    fireEvent.click(screen.getByRole('button', { name: /open in spotify/i }));
    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }));

    await waitFor(() => {
      expect(savedPayloads.length).toBe(1);
    });
    expect(savedPayloads[0].discoveryStyle).toBe('deep_cuts');
    expect(savedPayloads[0].playbackPreference).toBe('spotify');

    fireEvent.click(
      screen.getByRole('button', { name: /clear conversation history/i })
    );
    await waitFor(() => {
      expect(clearedHistory).toBe(true);
    });
  });

  it('creates, edits, removes, and clears structured AI memory', async () => {
    const memoryId = '11111111-1111-4111-8111-111111111111';
    let savedMemories: Array<{
      id: string;
      key: string;
      value: string;
      confidence: number;
      source: string;
      updatedAt: string;
    }> = [];

    vi.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      const json = (value: unknown, status = 200) =>
        new Response(JSON.stringify(value), {
          status,
          headers: { 'Content-Type': 'application/json' }
        });

      if (url === '/api/memory' && method === 'GET') {
        return json({ memories: savedMemories });
      }
      if (url === '/api/memory' && method === 'POST') {
        const body = JSON.parse(String(init?.body)) as {
          key: string;
          value: string;
        };
        const memory = {
          id: memoryId,
          ...body,
          confidence: 100,
          source: 'explicit',
          updatedAt: new Date().toISOString()
        };
        savedMemories = [memory];
        return json({ memory }, 201);
      }
      if (url === `/api/memory/${memoryId}` && method === 'PATCH') {
        const body = JSON.parse(String(init?.body)) as {
          key: string;
          value: string;
        };
        const memory = {
          ...savedMemories[0],
          ...body,
          updatedAt: new Date().toISOString()
        };
        savedMemories = [memory];
        return json({ memory });
      }
      if (url === `/api/memory/${memoryId}` && method === 'DELETE') {
        savedMemories = [];
        return json({ success: true });
      }
      if (url === '/api/memory' && method === 'DELETE') {
        savedMemories = [];
        return json({ success: true });
      }
      return json({});
    });

    renderWithProviders(<MemoryManager />);
    await screen.findByText('No structured preferences are saved yet.');

    fireEvent.click(screen.getByRole('button', { name: /add memory/i }));
    fireEvent.change(screen.getByLabelText('Preference'), {
      target: { value: 'Preferred genres' }
    });
    fireEvent.change(screen.getByLabelText('Value'), {
      target: { value: 'Neo-soul and UK jazz' }
    });
    fireEvent.click(screen.getByRole('button', { name: /add memory/i }));

    expect(
      await screen.findByRole('heading', { name: 'Preferred genres' })
    ).toBeDefined();
    expect(
      screen.getByText(/Source: explicit\. Confidence: 100 percent/)
    ).toBeDefined();

    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Preferred genres' })
    );
    fireEvent.change(screen.getByLabelText('Value'), {
      target: { value: 'Neo-soul, UK jazz, and highlife' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save memory' }));
    expect(
      await screen.findByText('Neo-soul, UK jazz, and highlife')
    ).toBeDefined();

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Preferred genres' })
    );
    await screen.findByText('No structured preferences are saved yet.');

    fireEvent.click(screen.getByRole('button', { name: /add memory/i }));
    fireEvent.change(screen.getByLabelText('Preference'), {
      target: { value: 'Listening mood' }
    });
    fireEvent.change(screen.getByLabelText('Value'), {
      target: { value: 'Warm and spacious' }
    });
    fireEvent.click(screen.getByRole('button', { name: /add memory/i }));
    await screen.findByRole('heading', { name: 'Listening mood' });

    fireEvent.click(screen.getByRole('button', { name: /clear all memory/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm clear all/i }));
    await screen.findByText('All saved memory was cleared.');
    expect(
      screen.getByText('No structured preferences are saved yet.')
    ).toBeDefined();
  });

  it('links the footer to real Privacy, Terms, and Spotify attribution pages', () => {
    render(<Footer />);

    const links = screen.getAllByRole('link');
    const destinations = links.map((link) => link.getAttribute('href'));
    expect(destinations).toContain('/privacy');
    expect(destinations).toContain('/terms');
    expect(destinations).toContain('/spotify-attribution');
    expect(
      destinations.every((destination) => destination && destination !== '#')
    ).toBe(true);
  });
});
