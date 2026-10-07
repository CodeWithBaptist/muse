// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The three deliberate discovery surfaces from sections 36, 37, and 38.
 *
 * `recommendation-engine` is deliberately left unmocked so the real
 * SpotifyCandidateTrackSchema does the filtering. That is the point of these
 * tests: the model proposes search queries and nothing else, and only tracks
 * Spotify actually returned and the real schema accepted can come back out.
 */

const mocks = vi.hoisted(() => ({
  structuredCompletion: vi.fn(),
  getTopArtists: vi.fn(),
  getTopTracks: vi.fn(),
  search: vi.fn(),
}));

vi.mock('./provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./provider')>();
  return { ...actual, structuredCompletion: mocks.structuredCompletion };
});

vi.mock('../spotify-service', () => ({
  spotifyService: {
    getTopArtists: mocks.getTopArtists,
    getTopTracks: mocks.getTopTracks,
    search: mocks.search,
  },
}));

vi.mock('./user-memory', () => ({
  getUserMemoryForPrompt: vi.fn().mockResolvedValue([]),
  formatUserMemoryContext: vi.fn().mockReturnValue(''),
}));

import {
  orchestrateArtistExploration,
  orchestrateDiscover,
  orchestrateSomewhereElse,
  orchestrateSurprise,
} from './discover-engine';

/** A track shaped the way Spotify returns one. */
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
    duration_ms: 210000,
  };
}

function searchReturning(...tracks: unknown[]) {
  return { tracks: { items: tracks } };
}

/** Pretends Spotify has real listening history for this user. */
function withTasteData() {
  mocks.getTopArtists.mockResolvedValue({
    items: [{ name: 'Tems' }, { name: 'Burna Boy' }],
  });
  mocks.getTopTracks.mockResolvedValue({
    items: [
      { name: 'Free Mind', artists: [{ name: 'Tems' }] },
      { name: 'Essence', artists: [{ name: 'Wizkid' }] },
    ],
  });
}

function withoutTasteData() {
  mocks.getTopArtists.mockResolvedValue({ items: [] });
  mocks.getTopTracks.mockResolvedValue({ items: [] });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.search.mockResolvedValue(searchReturning());
});

describe('section 36: take me somewhere else', () => {
  it('refuses to invent a starting point when there is no listening history', async () => {
    withoutTasteData();

    const result = await orchestrateSomewhereElse('user-1');

    expect(result.available).toBe(false);
    if (result.available === false) {
      expect(result.reason).toMatch(/listening history/i);
    }

    // The claim needs real data, so no model call is spent producing one.
    expect(mocks.structuredCompletion).not.toHaveBeenCalled();
  });

  it('builds the path from tracks Spotify actually returned', async () => {
    withTasteData();
    mocks.structuredCompletion.mockResolvedValue({
      startingPoint: 'Afrobeats',
      explanation:
        'The rhythmic production overlaps with the UK sound you have not explored much.',
      steps: [
        {
          title: 'Afro fusion',
          description: 'Where the sound loosens up.',
          searchQueries: ['afro fusion'],
        },
        {
          title: 'UK Afroswing',
          description: 'The same rhythm, colder air.',
          searchQueries: ['uk afroswing'],
        },
      ],
    });

    mocks.search
      .mockResolvedValueOnce(
        searchReturning(spotifyTrack('aaa', 'Joro Variant', 'J Hus'))
      )
      .mockResolvedValueOnce(
        searchReturning(spotifyTrack('bbb', 'Location Unknown', 'Jorja Smith'))
      );

    const result = await orchestrateSomewhereElse('user-1');

    expect(result.available).toBe(true);
    if (result.available !== true) return;

    expect(result.startingPoint).toBe('Afrobeats');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].tracks.map((t) => t.id)).toEqual(['aaa']);
    expect(result.steps[1].tracks.map((t) => t.id)).toEqual(['bbb']);
  });

  it('drops a step Spotify could not fill rather than showing an empty heading', async () => {
    withTasteData();
    mocks.structuredCompletion.mockResolvedValue({
      startingPoint: 'Afrobeats',
      explanation: 'A short move.',
      steps: [
        { title: 'Real step', description: 'Has tracks.', searchQueries: ['a'] },
        { title: 'Dead step', description: 'No tracks.', searchQueries: ['b'] },
      ],
    });

    mocks.search
      .mockResolvedValueOnce(
        searchReturning(spotifyTrack('aaa', 'Something', 'Someone'))
      )
      .mockResolvedValueOnce(searchReturning());

    const result = await orchestrateSomewhereElse('user-1');
    if (result.available !== true) throw new Error('expected taste data');

    expect(result.steps.map((step) => step.title)).toEqual(['Real step']);
  });

  it('never lets the model supply a track', async () => {
    withTasteData();
    mocks.structuredCompletion.mockResolvedValue({
      startingPoint: 'Afrobeats',
      explanation: 'A move.',
      // The model tries to smuggle tracks and an id of its own.
      steps: [
        {
          title: 'Smuggled',
          description: 'Should not appear.',
          searchQueries: ['q'],
          tracks: [spotifyTrack('invented', 'Invented Track', 'Nobody')],
        },
        {
          title: 'Second step',
          description: 'Normal.',
          searchQueries: ['q2'],
        },
      ],
    });

    mocks.search
      .mockResolvedValueOnce(
        searchReturning(spotifyTrack('real1', 'Real Track', 'Tems'))
      )
      .mockResolvedValueOnce(
        searchReturning(spotifyTrack('real2', 'Another Real Track', 'Lojay'))
      );

    const result = await orchestrateSomewhereElse('user-1');
    if (result.available !== true) throw new Error('expected taste data');

    expect(result.steps[0].tracks.map((t) => t.id)).toEqual(['real1']);
    expect(result.steps.map((s) => s.tracks.map((t) => t.id)).flat()).not.toContain(
      'invented'
    );
  });
});

describe('section 38: surprise me', () => {
  it('needs real taste data to claim something is outside it', async () => {
    withoutTasteData();

    const result = await orchestrateSurprise('user-1');

    expect(result.available).toBe(false);
    expect(mocks.structuredCompletion).not.toHaveBeenCalled();
  });

  it('returns a small result with the connection explained', async () => {
    withTasteData();
    mocks.structuredCompletion.mockResolvedValue({
      explanation:
        'This is outside your usual rotation, but the vocal style overlaps with what you play.',
      searchQueries: ['alternative rnb'],
    });

    mocks.search.mockResolvedValue(
      searchReturning(
        spotifyTrack('s1', 'One', 'A'),
        spotifyTrack('s2', 'Two', 'B'),
        spotifyTrack('s3', 'Three', 'C'),
        spotifyTrack('s4', 'Four', 'D'),
        spotifyTrack('s5', 'Five', 'E')
      )
    );

    const result = await orchestrateSurprise('user-1');
    if (result.available !== true) throw new Error('expected taste data');

    expect(result.explanation).toMatch(/outside your usual rotation/i);
    expect(result.tracks).toHaveLength(3);
  });

  it('drops results that fail the real Spotify track schema', async () => {
    withTasteData();
    mocks.structuredCompletion.mockResolvedValue({
      explanation: 'A surprise.',
      searchQueries: ['q'],
    });

    mocks.search.mockResolvedValue(
      searchReturning(
        spotifyTrack('good1', 'Valid Track', 'Tems'),
        // No name, so the real schema rejects it.
        { id: 'bad1', artists: [{ name: 'Nobody' }] },
        // No artists, so the real schema rejects it.
        { id: 'bad2', name: 'Orphan' },
        spotifyTrack('good2', 'Another Valid', 'Ayra Starr')
      )
    );

    const result = await orchestrateSurprise('user-1');
    if (result.available !== true) throw new Error('expected taste data');

    expect(result.tracks.map((t) => t.id)).toEqual(['good1', 'good2']);
  });
});

describe('section 37: explore this artist', () => {
  it('returns only the four spec angles, resolved through search', async () => {
    withTasteData();
    mocks.structuredCompletion.mockResolvedValue({
      artist: 'Tems',
      angles: [
        {
          kind: 'start-here',
          title: 'Start here',
          description: 'The two tracks to begin with.',
          searchQueries: ['tems'],
        },
        {
          kind: 'similar-sound',
          title: 'Similar sound',
          description: 'Comparable vocal production.',
          searchQueries: ['alternative rnb nigeria'],
        },
      ],
    });

    mocks.search
      .mockResolvedValueOnce(
        searchReturning(spotifyTrack('t1', 'Free Mind', 'Tems'))
      )
      .mockResolvedValueOnce(
        searchReturning(spotifyTrack('t2', 'Sensational', 'Ayra Starr'))
      );

    const result = await orchestrateArtistExploration('user-1', 'Tems');

    expect(result.artist).toBe('Tems');
    expect(result.angles.map((a) => a.kind)).toEqual([
      'start-here',
      'similar-sound',
    ]);
    expect(result.angles[0].tracks.map((t) => t.id)).toEqual(['t1']);
  });

  it('truncates an oversized artist name before it reaches the prompt', async () => {
    withTasteData();
    mocks.structuredCompletion.mockResolvedValue({
      artist: 'x',
      angles: [
        {
          kind: 'start-here',
          title: 'Start here',
          description: 'Placeholder.',
          searchQueries: ['q'],
        },
      ],
    });

    const longName = 'A'.repeat(400);
    await orchestrateArtistExploration('user-1', longName);

    const prompt = mocks.structuredCompletion.mock.calls[0][0] as string;
    expect(prompt).not.toContain(longName);
    expect(prompt).toContain('A'.repeat(120));
  });

  it('works for a new user, since exploring an artist needs no listening history', async () => {
    withoutTasteData();
    mocks.structuredCompletion.mockResolvedValue({
      artist: 'Fela Kuti',
      angles: [
        {
          kind: 'go-deeper',
          title: 'Go deeper',
          description: 'Album tracks beyond the compilations.',
          searchQueries: ['fela kuti album'],
        },
      ],
    });

    mocks.search.mockResolvedValueOnce(
      searchReturning(spotifyTrack('f1', 'Zombie', 'Fela Kuti'))
    );

    const result = await orchestrateArtistExploration('user-1', 'Fela Kuti');

    expect(result.angles).toHaveLength(1);
    expect(result.angles[0].tracks.map((t) => t.id)).toEqual(['f1']);
  });
});

describe('section 35: the discover page payload', () => {
  it('returns the real top artists for the exploration picker', async () => {
    withTasteData();
    mocks.structuredCompletion.mockResolvedValue({
      sections: [
        {
          title: 'Deep cuts',
          description: 'Less popular work from artists you like.',
          searchQueries: ['tems deep cut'],
        },
      ],
    });

    mocks.search.mockResolvedValue(
      searchReturning(spotifyTrack('d1', 'Ice TTS', 'Tems'))
    );

    const result = await orchestrateDiscover('user-1');

    expect(result.topArtists).toEqual(['Tems', 'Burna Boy']);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].tracks.map((t) => t.id)).toEqual(['d1']);
  });

  it('reports no top artists rather than guessing names', async () => {
    withoutTasteData();
    mocks.structuredCompletion.mockResolvedValue({
      sections: [
        { title: 'New territory', description: 'Somewhere new.', searchQueries: ['q'] },
      ],
    });

    const result = await orchestrateDiscover('user-1');

    expect(result.topArtists).toEqual([]);
  });
});
