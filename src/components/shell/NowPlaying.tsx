'use client';

import * as React from 'react';
import { ExternalLink, Disc, X } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import { Logo } from '@/components/ui/Logo';
import {
  useNowPlaying,
  formatTrackDuration,
  getSpotifyTrackUrl,
} from '@/hooks/use-now-playing';

export function NowPlaying() {
  const { selectedTrack, clearTrack } = useNowPlaying();

  const artistName = selectedTrack
    ? Array.isArray(selectedTrack.artists)
      ? selectedTrack.artists.map((a) => a.name).join(', ')
      : selectedTrack.artists
    : '';

  const artUrl =
    selectedTrack?.album?.images?.[0]?.url || selectedTrack?.albumArtUrl;
  const durationLabel = formatTrackDuration(selectedTrack?.duration_ms);
  const spotifyUrl = getSpotifyTrackUrl(selectedTrack?.id);

  return (
    <aside
      data-testid="now-playing-panel"
      className="w-[280px] border-l border-border-subtle bg-background flex flex-col hidden xl:flex"
    >
      {selectedTrack ? (
        <div className="p-6 flex-1 flex flex-col justify-between space-y-6 overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="type-section-label">Selected Track</span>
              <button
                type="button"
                onClick={clearTrack}
                aria-label="Clear selected track"
                className="p-1 text-text-muted hover:text-text-primary transition-colors rounded"
              >
                <X size={14} />
              </button>
            </div>

            <Surface
              variant="raised"
              className="w-full aspect-square flex items-center justify-center border-border-strong bg-surface overflow-hidden rounded-lg"
            >
              {artUrl ? (
                <img
                  src={artUrl}
                  alt={selectedTrack.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Disc size={40} className="text-text-muted/30" />
              )}
            </Surface>

            <div className="space-y-1">
              <h3 className="text-base font-semibold text-text-primary leading-snug">
                {selectedTrack.name}
              </h3>
              <p className="text-xs font-medium text-text-secondary">
                {artistName}
              </p>
              {durationLabel && (
                <p className="text-[11px] text-text-muted tabular-nums">
                  Duration: {durationLabel}
                </p>
              )}
            </div>

            {selectedTrack.reason && (
              <div className="p-3 rounded-md bg-surface border border-border-subtle space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">
                  Why this track
                </span>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {selectedTrack.reason}
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border-subtle space-y-3">
            {spotifyUrl && (
              <a
                href={spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-accent text-background text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                <span>Open in Spotify</span>
                <ExternalLink size={14} />
              </a>
            )}
            <p className="text-[11px] text-text-muted text-center leading-relaxed">
              Full track playback opens directly in Spotify.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="p-6 flex-1 flex flex-col justify-center items-center text-center space-y-6">
            <Surface
              variant="raised"
              className="w-full aspect-square flex items-center justify-center border-border-strong bg-surface/50 overflow-hidden"
            >
              <Logo variant="mark" size={48} className="opacity-10" />
            </Surface>

            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-text-muted">
                No track selected
              </h3>
              <p className="text-xs font-medium text-text-muted/60">
                Select any track to inspect details or open in Spotify
              </p>
            </div>
          </div>

          <div className="p-6 border-t border-border-subtle">
            <p className="text-[11px] text-text-muted text-center leading-relaxed">
              Playback runs through your connected Spotify app or web player.
            </p>
          </div>
        </>
      )}
    </aside>
  );
}
