import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { NowPlayingProvider } from '@/hooks/use-now-playing';
import { SelectionPanel } from './SelectionPanel';
import { parseRefinement } from '@/hooks/use-chat';
import type { SpotifyTrackItem } from '@/lib/validation/api-schemas';

vi.mock('motion/react', async () => {
  const { motionMock } = await import('@/test/motion-mock');
  return motionMock;
});

function track(id: string, name: string, artist: string): SpotifyTrackItem {
  return { id, name, artists: [{ name: artist }] };
}

const NIGHT_DRIVE = track('ng-1', 'Night Drive', 'Ayra Starr');
const SLOW_BURN = track('ng-5', 'Slow Burn', 'Burna Boy');
const HARMATTAN = track('ng-4', 'Harmattan', 'Tems');

function renderPanel(props: React.ComponentProps<typeof SelectionPanel>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NowPlayingProvider>
        <SelectionPanel {...props} />
      </NowPlayingProvider>
    </QueryClientProvider>
  );
}

const REFINEMENT = {
  summary: 'No Burna Boy, still late night.',
  excludedArtists: ['Burna Boy'],
  excludedGenres: [],
  avoided: [],
  keptTracks: 1,
  newTracks: 1,
  removedTracks: 1,
  droppedAlreadyShown: 0,
  droppedExcludedArtist: 1,
};

describe('SelectionPanel', () => {
  it('renders nothing until there is something to show', () => {
    const { container } = renderPanel({ tracks: [] });
    expect(container.firstChild).toBeNull();
  });

  it('keeps a surviving row mounted in place across a refinement', () => {
    const { rerender } = renderPanel({ tracks: [NIGHT_DRIVE, SLOW_BURN] });

    const before = screen.getByText('Night Drive').closest('[role="listitem"]');
    expect(before).not.toBeNull();
    expect(screen.getByText('Slow Burn')).toBeDefined();

    // The refinement rules out Burna Boy and adds a new row.
    rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
          })
        }
      >
        <NowPlayingProvider>
          <SelectionPanel tracks={[NIGHT_DRIVE, HARMATTAN]} refinement={REFINEMENT} />
        </NowPlayingProvider>
      </QueryClientProvider>
    );

    const after = screen.getByText('Night Drive').closest('[role="listitem"]');

    // Same DOM node, so the row stayed where it was rather than being torn down
    // and re-entered. This is the assertion section 26 is asking for.
    expect(after).toBe(before);
    expect(screen.queryByText('Slow Burn')).toBeNull();
    expect(screen.getByText('Harmattan')).toBeDefined();
  });

  it('reports what a refinement changed', () => {
    renderPanel({ tracks: [NIGHT_DRIVE, HARMATTAN], refinement: REFINEMENT });

    expect(screen.getByTestId('refinement-summary')).toBeDefined();
    expect(screen.getByText('Refined')).toBeDefined();
    expect(screen.getByText('No Burna Boy, still late night.')).toBeDefined();
    expect(screen.getByTestId('refinement-summary').textContent).toContain('1 kept');
    expect(screen.getByTestId('refinement-summary').textContent).toContain('1 new');
    expect(screen.getByTestId('refinement-summary').textContent).toContain('1 removed');
  });

  it('shows no refinement label on a first request', () => {
    renderPanel({ tracks: [NIGHT_DRIVE] });
    expect(screen.queryByTestId('refinement-summary')).toBeNull();
  });

  it('collapses a removed row out of the list', async () => {
    const changes: SpotifyTrackItem[][] = [];
    renderPanel({
      tracks: [NIGHT_DRIVE, SLOW_BURN],
      onTracksChange: (tracks) => changes.push(tracks),
    });

    fireEvent.click(screen.getByLabelText('Remove Slow Burn'));

    await waitFor(() => expect(screen.queryByText('Slow Burn')).toBeNull());

    // The removal is reported upward, so the next turn does not treat a row the
    // visitor dismissed as still being on screen.
    expect(changes).toHaveLength(1);
    expect(changes[0].map((item) => item.id)).toEqual(['ng-1']);
  });

  it('shows the honest empty state when search returned nothing', () => {
    renderPanel({ tracks: [], noResults: true });

    expect(screen.getByTestId('chat-no-results-state')).toBeDefined();
    expect(screen.getByText('No matching tracks found')).toBeDefined();
  });

  it('renders the playlist preview for a playlist suggestion', () => {
    renderPanel({
      tracks: [NIGHT_DRIVE, HARMATTAN],
      isPlaylistSuggestion: true,
      suggestedPlaylistName: 'Late night drive',
    });

    expect(screen.getByLabelText('Playlist Name')).toBeDefined();
    expect(screen.getByRole('button', { name: /create in spotify/i })).toBeDefined();
  });
});

describe('parseRefinement', () => {
  it('reads a well formed payload', () => {
    const parsed = parseRefinement(REFINEMENT);
    expect(parsed?.summary).toBe('No Burna Boy, still late night.');
    expect(parsed?.keptTracks).toBe(1);
    expect(parsed?.removedTracks).toBe(1);
  });

  it('ignores a payload with no usable summary', () => {
    expect(parseRefinement(null)).toBeUndefined();
    expect(parseRefinement('No Burna Boy')).toBeUndefined();
    expect(parseRefinement({ summary: '' })).toBeUndefined();
    expect(parseRefinement({ summary: 42 })).toBeUndefined();
  });

  it('drops malformed entries and defaults missing counts to zero', () => {
    const parsed = parseRefinement({
      summary: 'Refined',
      excludedArtists: ['Burna Boy', null, 7, { name: 'x' }],
      keptTracks: 'many',
    });

    expect(parsed?.excludedArtists).toEqual(['Burna Boy']);
    expect(parsed?.excludedGenres).toEqual([]);
    expect(parsed?.keptTracks).toBe(0);
    expect(parsed?.removedTracks).toBe(0);
  });
});
