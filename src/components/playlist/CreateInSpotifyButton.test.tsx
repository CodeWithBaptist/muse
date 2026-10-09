import * as React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateInSpotifyButton } from './CreateInSpotifyButton';
import type {
  CreateInSpotifyState,
  PlaylistExportRequest,
  PlaylistExportResult,
} from '@/lib/playlist-export';

const TRACK_URIS = [
  'spotify:track:1111111111111111111111',
  'spotify:track:2222222222222222222222',
  'spotify:track:3333333333333333333333',
];

const SUCCESS_RESULT: PlaylistExportResult = {
  spotifyUrl: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
  spotifyPlaylistId: '37i9dQZF1DXcBWIGoYBM5M',
  created: true,
  requestedCount: 3,
  addedCount: 3,
  failedTrackUris: [],
};

function renderButton(
  props: Partial<React.ComponentProps<typeof CreateInSpotifyButton>> = {},
) {
  return render(
    <CreateInSpotifyButton
      name="Late Night Mix"
      description="Curated in chat"
      trackUris={TRACK_URIS}
      {...props}
    />,
  );
}

const statusOf = () =>
  screen.getByTestId('create-in-spotify').getAttribute('data-status');

/**
 * During the cross fade the outgoing layer is still mounted, so the current
 * layer is the last one AnimatePresence renders.
 */
const currentLayer = () => {
  const layers = screen.getAllByTestId('create-in-spotify-layer');
  return layers[layers.length - 1];
};

describe('CreateInSpotifyButton', () => {
  it('shows the idle accent button and fires a real export request', async () => {
    let resolveRequest: ((result: PlaylistExportResult) => void) | undefined;
    const request = vi.fn(
      (_payload: PlaylistExportRequest) =>
        new Promise<PlaylistExportResult>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    renderButton({ request });

    const idleButton = screen.getByRole('button', {
      name: 'Create in Spotify',
    });
    expect(idleButton.className).toContain('bg-accent-primary');

    fireEvent.click(idleButton);

    await waitFor(() => {
      expect(request).toHaveBeenCalledTimes(1);
    });
    const payload = request.mock.calls[0][0];
    expect(payload.name).toBe('Late Night Mix');
    expect(payload.trackUris).toEqual(TRACK_URIS);

    expect(statusOf()).toBe('loading');
    expect(
      screen.getByRole('button', { name: 'Creating this in Spotify' }),
    ).toBeDisabled();
    expect(screen.getByTestId('create-in-spotify-status').textContent).toBe(
      'Creating this in Spotify.',
    );

    await act(async () => {
      resolveRequest?.(SUCCESS_RESULT);
    });

    await waitFor(() => {
      expect(statusOf()).toBe('success');
    });
    const primary = currentLayer().querySelector(
      '[data-testid="create-in-spotify-primary"]',
    );
    expect(primary?.textContent).toContain('Playlist created.');
    expect(primary).toHaveAttribute('data-success', 'true');
    expect(screen.getByTestId('create-in-spotify-status').textContent).toBe(
      'Playlist created in Spotify.',
    );
  });

  it('holds success briefly and then links to the real playlist', async () => {
    vi.useFakeTimers();
    try {
      const request = vi.fn(
        async (_payload: PlaylistExportRequest) => SUCCESS_RESULT,
      );
      renderButton({ request });

      fireEvent.click(
        screen.getByRole('button', { name: 'Create in Spotify' }),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(statusOf()).toBe('success');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1300);
      });

      expect(statusOf()).toBe('open');
      const link = screen.getByRole('link', { name: 'Open in Spotify' });
      expect(link).toHaveAttribute('href', SUCCESS_RESULT.spotifyUrl);
      expect(link).toHaveAttribute('target', '_blank');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows a full failure with a Try again action and never success', async () => {
    const request = vi.fn(async (_payload: PlaylistExportRequest) => {
      throw new Error('Spotify is unavailable right now.');
    });

    renderButton({ request });
    fireEvent.click(screen.getByRole('button', { name: 'Create in Spotify' }));

    await waitFor(() => {
      expect(statusOf()).toBe('error');
    });

    const message =
      "Couldn't create the playlist. Spotify is unavailable right now.";
    expect(
      currentLayer().querySelector('[data-testid="create-in-spotify-primary"]')
        ?.textContent,
    ).toBe(message);
    expect(screen.getByTestId('create-in-spotify-alert').textContent).toBe(
      message,
    );
    expect(screen.queryByRole('link', { name: 'Open in Spotify' })).toBeNull();
    expect(
      screen.getByRole('button', { name: /try again to create the playlist/i }),
    ).toBeDefined();

    fireEvent.click(
      screen.getByRole('button', { name: /try again to create the playlist/i }),
    );
    await waitFor(() => {
      expect(request).toHaveBeenCalledTimes(2);
    });
  });

  it('shows a partial failure and retries only the missing tracks against the same playlist', async () => {
    const partialResult: PlaylistExportResult = {
      ...SUCCESS_RESULT,
      addedCount: 1,
      failedTrackUris: [TRACK_URIS[1], TRACK_URIS[2]],
    };
    const recoveredResult: PlaylistExportResult = {
      ...SUCCESS_RESULT,
      requestedCount: 2,
      addedCount: 2,
    };

    const request = vi
      .fn(async (_payload: PlaylistExportRequest) => partialResult)
      .mockResolvedValueOnce(partialResult)
      .mockResolvedValueOnce(recoveredResult);

    renderButton({ request });
    fireEvent.click(screen.getByRole('button', { name: 'Create in Spotify' }));

    await waitFor(() => {
      expect(statusOf()).toBe('partial');
    });

    expect(
      currentLayer().querySelector('[data-testid="create-in-spotify-primary"]')
        ?.textContent,
    ).toBe('Playlist created, but 2 tracks were not added.');
    const openLink = screen.getByRole('link', { name: 'Open in Spotify' });
    expect(openLink).toHaveAttribute('href', SUCCESS_RESULT.spotifyUrl);

    fireEvent.click(
      screen.getByRole('button', {
        name: /try again to add the missing tracks/i,
      }),
    );

    await waitFor(() => {
      expect(request).toHaveBeenCalledTimes(2);
    });

    const retryPayload = request.mock.calls[1][0];
    expect(retryPayload.trackUris).toEqual([TRACK_URIS[1], TRACK_URIS[2]]);
    expect(retryPayload.spotifyPlaylistId).toBe(
      SUCCESS_RESULT.spotifyPlaylistId,
    );

    await waitFor(() => {
      expect(statusOf()).toBe('success');
    });
  });

  it('renders a controlled state without running any request', () => {
    const request = vi.fn(
      async (_payload: PlaylistExportRequest) => SUCCESS_RESULT,
    );
    const controlled: CreateInSpotifyState = {
      status: 'open',
      spotifyUrl: SUCCESS_RESULT.spotifyUrl,
      spotifyPlaylistId: SUCCESS_RESULT.spotifyPlaylistId,
      requestedCount: 3,
      addedCount: 3,
      failedTrackUris: [],
      error: null,
      retryingFailedOnly: false,
    };

    renderButton({ request, state: controlled });

    expect(statusOf()).toBe('open');
    expect(
      screen.getByRole('link', { name: 'Open in Spotify' }),
    ).toHaveAttribute('href', SUCCESS_RESULT.spotifyUrl);
    expect(
      screen.queryByRole('button', { name: 'Create in Spotify' }),
    ).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it('renders every control inert for the landing demo', () => {
    const controlled: CreateInSpotifyState = {
      status: 'partial',
      spotifyUrl: SUCCESS_RESULT.spotifyUrl,
      spotifyPlaylistId: SUCCESS_RESULT.spotifyPlaylistId,
      requestedCount: 3,
      addedCount: 1,
      failedTrackUris: [TRACK_URIS[2]],
      error: null,
      retryingFailedOnly: false,
    };

    renderButton({ state: controlled, inert: true });

    expect(statusOf()).toBe('partial');
    expect(
      currentLayer().querySelector('[data-testid="create-in-spotify-primary"]')
        ?.textContent,
    ).toBe('Playlist created, but 1 track was not added.');
    // Nothing focusable or fake is exposed in the inert demo.
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByTestId('create-in-spotify-retry')).toBeDisabled();
    expect(screen.getByTestId('create-in-spotify-open')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});
