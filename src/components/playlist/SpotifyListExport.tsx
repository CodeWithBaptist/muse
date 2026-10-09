'use client';

import * as React from 'react';
import { useAuth } from '@/hooks/use-auth';
import {
  requestPlaylistExport,
  type PlaylistExportResult,
} from '@/lib/playlist-export';
import type { ListedTrack } from '@/lib/catalogue/types';
import { cn } from '@/lib/utils';

/**
 * Tester-only export of a MUSE list to the signed-in tester's Spotify.
 * Renders nothing for visitors without an account, so no public screen
 * ever shows a Spotify action. Two honest steps: find the songs on Spotify
 * (reporting the ones it could not), then create the playlist with the
 * existing export, reporting exactly what Spotify confirmed.
 */

type Phase =
  | { kind: 'idle' }
  | { kind: 'resolving' }
  | { kind: 'creating'; found: number; missing: string[] }
  | { kind: 'done'; result: PlaylistExportResult; missing: string[] }
  | { kind: 'error'; message: string };

interface ResolveResponse {
  resolved: Array<{
    id: string;
    uri: string;
    spotifyId: string;
    title: string;
    artist: string;
    albumArtUrl?: string | null;
    durationMs?: number;
  }>;
  unresolved: string[];
}

export interface SpotifyListExportProps {
  title: string;
  tracks: ListedTrack[];
  className?: string;
}

export function SpotifyListExport({
  title,
  tracks,
  className,
}: SpotifyListExportProps) {
  const { authenticated } = useAuth();
  const [phase, setPhase] = React.useState<Phase>({ kind: 'idle' });

  if (!authenticated || tracks.length === 0) return null;

  const missingTitles = (ids: string[]) =>
    ids
      .map((id) => tracks.find((track) => track.id === id))
      .filter((track): track is ListedTrack => Boolean(track))
      .map((track) => `${track.title} by ${track.artist}`);

  const run = async () => {
    setPhase({ kind: 'resolving' });
    try {
      const response = await fetch('/api/playlists/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracks: tracks.map((track) => ({
            id: track.id,
            title: track.title,
            artist: track.artist,
          })),
        }),
      });
      const body = (await response.json().catch(() => null)) as
        (ResolveResponse & { error?: string }) | null;
      if (!response.ok || !body) {
        setPhase({
          kind: 'error',
          message: body?.error ?? 'Spotify could not be reached right now.',
        });
        return;
      }
      const missing = missingTitles(body.unresolved);
      if (body.resolved.length === 0) {
        setPhase({
          kind: 'error',
          message:
            'None of these songs could be found on Spotify, so no playlist was created.',
        });
        return;
      }
      setPhase({ kind: 'creating', found: body.resolved.length, missing });
      const result = await requestPlaylistExport({
        name: title,
        description: 'Built with MUSE',
        trackUris: body.resolved.map((item) => item.uri),
        tracks: body.resolved.map((item) => ({
          id: item.spotifyId,
          title: item.title,
          artist: item.artist,
          albumArtUrl: item.albumArtUrl,
          durationMs: item.durationMs,
        })),
      });
      setPhase({ kind: 'done', result, missing });
    } catch (error) {
      setPhase({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to export to Spotify right now.',
      });
    }
  };

  const busy = phase.kind === 'resolving' || phase.kind === 'creating';

  return (
    <div
      className={cn('space-y-2', className)}
      data-testid="spotify-list-export"
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border-strong px-4 text-xs font-semibold text-text-primary transition-colors hover:bg-surface focus-ring disabled:opacity-50"
        >
          {phase.kind === 'resolving'
            ? 'Finding songs on Spotify'
            : phase.kind === 'creating'
              ? 'Creating playlist'
              : 'Create in Spotify'}
        </button>
        <span className="text-xs text-text-muted">
          Testers only. Creates the playlist in your own Spotify account.
        </span>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={cn(
          'min-h-4 text-xs',
          phase.kind === 'error' ? 'text-danger' : 'text-text-secondary',
        )}
      >
        {phase.kind === 'creating'
          ? `Found ${phase.found} of ${tracks.length} on Spotify.${phase.missing.length ? ` Not found: ${phase.missing.join(', ')}.` : ''}`
          : phase.kind === 'done'
            ? `${phase.result.addedCount} of ${tracks.length} added. ${phase.missing.length ? `Not on Spotify: ${phase.missing.join(', ')}. ` : ''}`
            : phase.kind === 'error'
              ? phase.message
              : ''}
        {phase.kind === 'done' ? (
          <a
            href={phase.result.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-text-primary underline-offset-2 hover:underline focus-ring"
          >
            Open the playlist on Spotify
          </a>
        ) : null}
      </p>
    </div>
  );
}
