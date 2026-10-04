'use client';

import * as React from 'react';
import {
  createInSpotifyReducer,
  initialCreateInSpotifyState,
  requestPlaylistExport,
  SUCCESS_HOLD_MS,
  type CreateInSpotifyState,
  type PlaylistExportFetcher,
  type PlaylistExportRequest,
  type PlaylistExportResult,
} from '@/lib/playlist-export';

export interface CreateInSpotifyRequestMode {
  retryingFailedOnly: boolean;
  failedTrackUris: string[];
  spotifyPlaylistId: string | null;
}

export interface UseCreateInSpotifyOptions {
  /**
   * Builds the real request payload. Called with the current machine mode so a
   * retry can target only the tracks the API reported as missing.
   */
  buildRequest: (
    mode: CreateInSpotifyRequestMode,
  ) => PlaylistExportRequest | null;
  /** Injectable for tests. Defaults to the real export request. */
  request?: PlaylistExportFetcher;
  onResult?: (result: PlaylistExportResult) => void;
  onError?: (message: string) => void;
  successHoldMs?: number;
}

export interface UseCreateInSpotifyResult {
  state: CreateInSpotifyState;
  create: () => void;
  retry: () => void;
  reset: () => void;
  isBusy: boolean;
}

/**
 * Drives the Create in Spotify state machine with real requests only. The
 * success state lives for a short hold before the control becomes a link to the
 * playlist that Spotify actually returned.
 */
export function useCreateInSpotify({
  buildRequest,
  request,
  onResult,
  onError,
  successHoldMs = SUCCESS_HOLD_MS,
}: UseCreateInSpotifyOptions): UseCreateInSpotifyResult {
  const [state, dispatch] = React.useReducer(
    createInSpotifyReducer,
    initialCreateInSpotifyState,
  );
  const inFlightRef = React.useRef(false);

  React.useEffect(() => {
    if (state.status !== 'success') return;
    const timer = setTimeout(() => {
      dispatch({ type: 'settle' });
    }, successHoldMs);
    return () => clearTimeout(timer);
  }, [state.status, successHoldMs]);

  const run = React.useCallback(
    async (retryingFailedOnly: boolean, current: CreateInSpotifyState) => {
      if (current.status === 'loading' || inFlightRef.current) return;

      const payload = buildRequest({
        retryingFailedOnly,
        failedTrackUris: current.failedTrackUris,
        spotifyPlaylistId: current.spotifyPlaylistId,
      });

      if (!payload || payload.trackUris.length === 0) return;

      inFlightRef.current = true;
      dispatch({
        type: 'start',
        requestedCount: payload.trackUris.length,
        retryingFailedOnly,
      });

      const fetchExport = request ?? requestPlaylistExport;

      try {
        const result = await fetchExport(payload);
        dispatch({ type: 'resolved', result });
        onResult?.(result);
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to export playlist to Spotify right now.';
        dispatch({ type: 'rejected', error: message });
        onError?.(message);
      } finally {
        inFlightRef.current = false;
      }
    },
    [buildRequest, onError, onResult, request],
  );

  const create = React.useCallback(() => {
    void run(false, state);
  }, [run, state]);

  const retry = React.useCallback(() => {
    const retryingFailedOnly =
      state.status === 'partial' && state.failedTrackUris.length > 0;
    void run(retryingFailedOnly, state);
  }, [run, state]);

  const reset = React.useCallback(() => {
    dispatch({ type: 'reset' });
  }, []);

  return { state, create, retry, reset, isBusy: state.status === 'loading' };
}
