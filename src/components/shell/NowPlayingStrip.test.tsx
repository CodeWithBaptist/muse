import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NowPlayingProvider } from '@/hooks/use-now-playing';
import { TrackRow } from '@/components/chat/TrackRow';
import { NowPlayingStrip, shortPlaybackNotice } from './NowPlayingStrip';

vi.mock('motion/react', async () => {
  const { motionMock } = await import('@/test/motion-mock');
  return motionMock;
});

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NowPlayingProvider>{ui}</NowPlayingProvider>
    </QueryClientProvider>,
  );
}

const track = {
  id: '3n3Ppam7vgaVa1iaRUc9Lp',
  name: 'Midnight Signal',
  artists: [{ name: 'Solange' }],
  duration_ms: 215000,
};

describe('NowPlayingStrip', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({}), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing until a track is selected', () => {
    renderWithProviders(<NowPlayingStrip />);
    expect(screen.queryByTestId('now-playing-strip')).toBeNull();
  });

  it('shows the selected track, an honest notice, and the Spotify link', async () => {
    renderWithProviders(
      <div>
        <TrackRow track={track} index={0} />
        <NowPlayingStrip />
      </div>,
    );

    fireEvent.click(screen.getByText('Midnight Signal'));

    const strip = await screen.findByTestId('now-playing-strip');
    expect(strip.className).toContain('xl:hidden');
    expect(strip.className).not.toContain('fixed');
    expect(strip.textContent).toContain('Midnight Signal');
    expect(strip.textContent).toContain('Solange');

    // The row has its own Spotify link; check the one inside the strip.
    const open = strip.querySelector(
      'a[aria-label="Open Midnight Signal in Spotify"]',
    );
    expect(open?.getAttribute('href')).toBe(
      'https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp',
    );
    expect(open?.className).toContain('h-10 w-10');
    expect(open?.className).toContain('focus-ring');
  });
});

describe('shortPlaybackNotice', () => {
  const base = {
    playbackNotice: null,
    playbackPreference: 'muse' as const,
    availability: 'ready' as const,
    isActiveTrack: false,
  };

  it('prefers an explicit notice and otherwise explains the availability state', () => {
    expect(
      shortPlaybackNotice({ ...base, playbackNotice: 'Device went away.' }),
    ).toBe('Device went away.');
    expect(shortPlaybackNotice(base)).toBe(
      'Open Spotify on an active device to play from MUSE.',
    );
    expect(shortPlaybackNotice({ ...base, availability: 'disconnected' })).toBe(
      'Connect Spotify to play here.',
    );
    expect(
      shortPlaybackNotice({ ...base, availability: 'premium-required' }),
    ).toBe('Eligible Spotify Premium is required for playback here.');
    expect(shortPlaybackNotice({ ...base, isActiveTrack: true })).toBeNull();
  });
});
