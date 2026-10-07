// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Section 34. Playlist evolution proposals.
 *
 * `recommendation-engine` is left unmocked so the real track schema does the
 * filtering. The properties that matter here are that a proposal can never
 * repeat what the playlist already holds, and that nothing in this module can
 * write anywhere, because a preview that changed something would break the
 * rule that Spotify is untouched until the visitor confirms.
 */

const mocks = vi.hoisted(() => ({
  structuredCompletion: vi.fn(),
  search: vi.fn(),
}));

vi.mock('./provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./provider')>();
  return { ...actual, structuredCompletion: mocks.structuredCompletion };
});

vi.mock('../spotify-service', () => ({
  spotifyService: { search: mocks.search },
}));

import { orchestratePlaylistEvolution } from './playlist-evolution';

function spotifyTrack(id: string, name: string, artist: string) {
  return {
    id,
    name,
    uri: `spotify:track:${id}`,
    artists: [{ id: `artist-${id}`, name: artist }],
    album: {
      id: `album-${id}`,
      name: `Album for ${name}`,
      images: [{ url: `https://i.scdn.co/image/${id}`, width: 300, height: 300 }],
    },
    duration_ms: 200000,
  };
}

const EXISTING = [
  { title: 'Free Mind', artist: 'Tems' },
  { title: 'Essence', artist: 'Wizkid' },
];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.structuredCompletion.mockResolvedValue({
    explanation: 'These would keep the same mood.',
    searchQueries: ['nigerian rnb'],
  });
  mocks.search.mockResolvedValue({ tracks: { items: [] } });
});

describe('playlist evolution proposals', () => {
  it('excludes tracks the playlist already holds', async () => {
    mocks.search.mockResolvedValue({
      tracks: {
        items: [
          spotifyTrack('dup1', 'Free Mind', 'Tems'),
          spotifyTrack('new1', 'Damages', 'Tems'),
        ],
      },
    });

    const result = await orchestratePlaylistEvolution('user-1', {
      playlistName: 'Late night',
      existingTracks: EXISTING,
      intent: 'more-like-this',
    });

    expect(result.tracks.map((t) => t.id)).toEqual(['new1']);
    expect(result.skippedDuplicates).toBe(1);
  });

  it('matches duplicates regardless of capitalisation', async () => {
    mocks.search.mockResolvedValue({
      tracks: { items: [spotifyTrack('dup2', 'free mind', 'tems')] },
    });

    const result = await orchestratePlaylistEvolution('user-1', {
      playlistName: 'Late night',
      existingTracks: EXISTING,
      intent: 'keep-it-fresh',
    });

    expect(result.tracks).toEqual([]);
    expect(result.skippedDuplicates).toBe(1);
  });

  it('excludes existing artists entirely for add new discoveries', async () => {
    mocks.search.mockResolvedValue({
      tracks: {
        items: [
          // Same artist as an existing track, different song. That is not a new
          // discovery, so it is dropped for this intent only.
          spotifyTrack('t1', 'Ice TTS', 'Tems'),
          spotifyTrack('t2', 'Sensational', 'Ayra Starr'),
        ],
      },
    });

    const result = await orchestratePlaylistEvolution('user-1', {
      playlistName: 'Late night',
      existingTracks: EXISTING,
      intent: 'add-new-discoveries',
    });

    expect(result.tracks.map((t) => t.id)).toEqual(['t2']);
    expect(result.skippedDuplicates).toBe(1);
  });

  it('keeps another track by an existing artist for more like this', async () => {
    mocks.search.mockResolvedValue({
      tracks: { items: [spotifyTrack('t1', 'Ice TTS', 'Tems')] },
    });

    const result = await orchestratePlaylistEvolution('user-1', {
      playlistName: 'Late night',
      existingTracks: EXISTING,
      intent: 'more-like-this',
    });

    expect(result.tracks.map((t) => t.id)).toEqual(['t1']);
  });

  it('caps the proposal rather than flooding the playlist', async () => {
    mocks.search.mockResolvedValue({
      tracks: {
        items: Array.from({ length: 30 }, (_, i) =>
          spotifyTrack(`t${i}`, `Track ${i}`, 'Someone New')
        ),
      },
    });

    const result = await orchestratePlaylistEvolution('user-1', {
      playlistName: 'Late night',
      existingTracks: EXISTING,
      intent: 'keep-it-fresh',
    });

    expect(result.tracks).toHaveLength(10);
  });

  it('drops results that fail the real Spotify track schema', async () => {
    mocks.search.mockResolvedValue({
      tracks: {
        items: [
          spotifyTrack('good', 'Real Track', 'Lojay'),
          { id: 'bad', artists: [{ name: 'No Title' }] },
          'not a track at all',
        ],
      },
    });

    const result = await orchestratePlaylistEvolution('user-1', {
      playlistName: 'Late night',
      existingTracks: EXISTING,
      intent: 'more-energetic',
    });

    expect(result.tracks.map((t) => t.id)).toEqual(['good']);
  });

  it('works on an empty playlist without inventing a starting point', async () => {
    mocks.search.mockResolvedValue({
      tracks: { items: [spotifyTrack('t1', 'First Track', 'Fave')] },
    });

    const result = await orchestratePlaylistEvolution('user-1', {
      playlistName: 'Empty draft',
      existingTracks: [],
      intent: 'more-like-this',
    });

    expect(result.tracks).toHaveLength(1);
    expect(result.skippedDuplicates).toBe(0);
  });

  it('survives a search failure and reports what it did find', async () => {
    mocks.search
      .mockRejectedValueOnce(new Error('Spotify is not responding'))
      .mockResolvedValueOnce({
        tracks: { items: [spotifyTrack('t1', 'Survivor', 'Oxlade')] },
      });
    mocks.structuredCompletion.mockResolvedValue({
      explanation: 'A narrower proposal.',
      searchQueries: ['first query', 'second query'],
    });

    const result = await orchestratePlaylistEvolution('user-1', {
      playlistName: 'Late night',
      existingTracks: EXISTING,
      intent: 'keep-it-fresh',
    });

    expect(result.tracks.map((t) => t.id)).toEqual(['t1']);
  });

  it('never lets the model supply a track', async () => {
    mocks.structuredCompletion.mockResolvedValue({
      explanation: 'Smuggling attempt.',
      searchQueries: ['q'],
      tracks: [spotifyTrack('invented', 'Invented', 'Nobody')],
    });
    mocks.search.mockResolvedValue({
      tracks: { items: [spotifyTrack('real', 'Real One', 'Victony')] },
    });

    const result = await orchestratePlaylistEvolution('user-1', {
      playlistName: 'Late night',
      existingTracks: EXISTING,
      intent: 'more-like-this',
    });

    expect(result.tracks.map((t) => t.id)).toEqual(['real']);
  });
});
