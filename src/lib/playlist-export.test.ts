import { describe, expect, it } from 'vitest';
import {
  createInSpotifyReducer,
  initialCreateInSpotifyState,
  createInSpotifyAnnouncement,
  createInSpotifyLabel,
  createInSpotifyMessage,
  type CreateInSpotifyState,
  type PlaylistExportResult,
} from './playlist-export';

const createdResult: PlaylistExportResult = {
  spotifyUrl: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
  spotifyPlaylistId: '37i9dQZF1DXcBWIGoYBM5M',
  created: true,
  requestedCount: 3,
  addedCount: 3,
  failedTrackUris: [],
};

function reduce(
  events: Parameters<typeof createInSpotifyReducer>[1][],
): CreateInSpotifyState {
  return events.reduce(
    (state, event) => createInSpotifyReducer(state, event),
    initialCreateInSpotifyState,
  );
}

describe('Create in Spotify state machine', () => {
  it('starts idle and reports the idle label with no announcement', () => {
    expect(initialCreateInSpotifyState.status).toBe('idle');
    expect(createInSpotifyLabel(initialCreateInSpotifyState)).toBe(
      'Create in Spotify',
    );
    expect(createInSpotifyAnnouncement(initialCreateInSpotifyState)).toBe('');
  });

  it('moves to loading while the real request is running', () => {
    const state = reduce([{ type: 'start', requestedCount: 3 }]);
    expect(state.status).toBe('loading');
    expect(state.requestedCount).toBe(3);
    expect(createInSpotifyLabel(state)).toBe('Creating this in Spotify');
    expect(createInSpotifyAnnouncement(state)).toBe('Creating this in Spotify.');
  });

  it('reaches success only with a playlist the API returned', () => {
    const state = reduce([
      { type: 'start', requestedCount: 3 },
      { type: 'resolved', result: createdResult },
    ]);
    expect(state.status).toBe('success');
    expect(state.spotifyUrl).toBe(createdResult.spotifyUrl);
    expect(state.spotifyPlaylistId).toBe(createdResult.spotifyPlaylistId);
    expect(createInSpotifyLabel(state)).toBe('Playlist created.');
    expect(createInSpotifyAnnouncement(state)).toBe(
      'Playlist created in Spotify.',
    );

    const open = createInSpotifyReducer(state, { type: 'settle' });
    expect(open.status).toBe('open');
    expect(createInSpotifyLabel(open)).toBe('Open in Spotify');
    expect(open.spotifyUrl).toBe(createdResult.spotifyUrl);
  });

  it('keeps a failure a failure and offers a retry', () => {
    const state = reduce([
      { type: 'start', requestedCount: 3 },
      { type: 'rejected', error: 'Spotify refused the request.' },
    ]);
    expect(state.status).toBe('error');
    expect(state.spotifyUrl).toBeNull();
    expect(createInSpotifyMessage(state)).toBe(
      "Couldn't create the playlist. Spotify refused the request.",
    );
    expect(createInSpotifyAnnouncement(state)).toBe(
      "Couldn't create the playlist. Try again.",
    );
  });

  it('reports a partial failure without ever claiming success', () => {
    const partial: PlaylistExportResult = {
      ...createdResult,
      addedCount: 1,
      failedTrackUris: [
        'spotify:track:1111111111111111111111',
        'spotify:track:2222222222222222222222',
      ],
    };
    const state = reduce([
      { type: 'start', requestedCount: 3 },
      { type: 'resolved', result: partial },
    ]);

    expect(state.status).toBe('partial');
    expect(state.status).not.toBe('success');
    expect(state.spotifyUrl).toBe(createdResult.spotifyUrl);
    expect(state.failedTrackUris).toHaveLength(2);
    expect(createInSpotifyMessage(state)).toBe(
      'Playlist created, but 2 tracks were not added.',
    );
    expect(createInSpotifyLabel(state)).toBe('Try again');
  });

  it('retries only the failed tracks against the same playlist', () => {
    const partial: PlaylistExportResult = {
      ...createdResult,
      addedCount: 1,
      failedTrackUris: ['spotify:track:1111111111111111111111'],
    };
    const retrying = reduce([
      { type: 'start', requestedCount: 3 },
      { type: 'resolved', result: partial },
      { type: 'start', requestedCount: 1, retryingFailedOnly: true },
    ]);

    expect(retrying.status).toBe('loading');
    expect(retrying.retryingFailedOnly).toBe(true);
    expect(retrying.spotifyPlaylistId).toBe(createdResult.spotifyPlaylistId);

    const recovered = createInSpotifyReducer(retrying, {
      type: 'resolved',
      result: { ...createdResult, requestedCount: 1, addedCount: 1 },
    });
    expect(recovered.status).toBe('success');
  });

  it('keeps the playlist when a retry request fails, instead of a full failure', () => {
    const partial: PlaylistExportResult = {
      ...createdResult,
      addedCount: 1,
      failedTrackUris: ['spotify:track:1111111111111111111111'],
    };
    const state = reduce([
      { type: 'start', requestedCount: 3 },
      { type: 'resolved', result: partial },
      { type: 'start', requestedCount: 1, retryingFailedOnly: true },
      { type: 'rejected', error: 'Spotify is unavailable.' },
    ]);

    expect(state.status).toBe('partial');
    expect(state.spotifyUrl).toBe(createdResult.spotifyUrl);
    expect(createInSpotifyMessage(state)).toBe(
      'Playlist created, but 1 track was not added.',
    );
  });

  it('resets back to idle and never keeps a stale playlist', () => {
    const state = reduce([
      { type: 'start', requestedCount: 3 },
      { type: 'resolved', result: createdResult },
      { type: 'settle' },
      { type: 'reset' },
    ]);
    expect(state).toEqual(initialCreateInSpotifyState);
  });
});
