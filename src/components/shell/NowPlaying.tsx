"use client";

import * as React from "react";
import { Disc, ExternalLink, X } from "lucide-react";
import { Surface } from "@/components/ui/Surface";
import { Logo } from "@/components/ui/Logo";
import {
  formatTrackDuration,
  getSpotifyTrackUrl,
  useNowPlaying,
} from "@/hooks/use-now-playing";
import { PlaybackButton } from "./PlaybackButton";
import { TrackArtwork } from "./TrackArtwork";

function artistLabel(track: { artists: { name: string }[] | string }) {
  return Array.isArray(track.artists)
    ? track.artists.map((artist) => artist.name).join(", ")
    : track.artists;
}

function availabilityMessage(
  availability: ReturnType<typeof useNowPlaying>["availability"],
) {
  if (availability === "checking") return "Checking Spotify playback access.";
  if (availability === "disconnected") {
    return "Connect Spotify to use playback in MUSE.";
  }
  if (availability === "reconnect-required") {
    return "Reconnect Spotify to enable playback in MUSE.";
  }
  if (availability === "premium-required") {
    return "An eligible Spotify Premium subscription is required for full playback in MUSE.";
  }
  if (availability === "unavailable") {
    return "Playback is unavailable here. Open this track in Spotify.";
  }
  if (availability === "ready") {
    return "Open Spotify on an active device to start playback from MUSE.";
  }
  return null;
}

export function NowPlaying() {
  const {
    selectedTrack,
    activeTrack,
    availability,
    playbackPreference,
    isPlaying,
    isBuffering,
    playbackMode,
    playbackNotice,
    clearTrack,
    getPlaybackAction,
    playTrack,
    togglePlayback,
    isTrackPlaying,
    isTrackBuffering,
  } = useNowPlaying();

  const track =
    isPlaying || isBuffering
      ? (activeTrack ?? selectedTrack)
      : (selectedTrack ?? activeTrack);

  if (!track) {
    return (
      <aside
        aria-label="Now playing"
        data-testid="now-playing-panel"
        className="hidden w-[var(--muse-now-playing-width)] shrink-0 flex-col border-l border-border-subtle bg-background xl:flex"
      >
        <div className="flex flex-1 flex-col items-center justify-center space-y-6 p-6 text-center">
          <Surface
            variant="raised"
            className="flex aspect-square w-full items-center justify-center overflow-hidden border-border-strong bg-surface/50"
          >
            <Logo variant="mark" size={48} className="opacity-10" />
          </Surface>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-text-muted">
              No track selected
            </h3>
            <p className="text-xs font-medium text-text-muted">
              Select a track to see playback options
            </p>
          </div>
        </div>
        <div className="border-t border-border-subtle p-6">
          <p className="text-center text-[11px] leading-relaxed text-text-muted">
            Playback from MUSE uses an active Spotify device and may require an
            eligible Premium subscription. Track links open in Spotify.
          </p>
        </div>
      </aside>
    );
  }

  const artistName = artistLabel(track);
  const artUrl = track.album?.images?.[0]?.url || track.albumArtUrl;
  const durationLabel = formatTrackDuration(track.duration_ms);
  const spotifyUrl = getSpotifyTrackUrl(track.id);
  const action = getPlaybackAction(track);
  const playing = isTrackPlaying(track.id);
  const busy = isTrackBuffering(track.id);
  const isActiveTrack = activeTrack?.id === track.id && playbackMode !== null;
  const actionLabel =
    action === "spotify" ? `Play ${track.name} on Spotify` : "";
  const notice =
    playbackNotice ??
    (playbackPreference === "spotify" && !isActiveTrack
      ? "Your playback preference is Spotify. Open this track there to listen."
      : availabilityMessage(availability));

  const handlePlayback = () => {
    if (isActiveTrack) {
      void togglePlayback();
    } else {
      void playTrack(track);
    }
  };

  return (
    <aside
      aria-label="Now playing"
      data-testid="now-playing-panel"
      className="hidden w-[var(--muse-now-playing-width)] shrink-0 flex-col border-l border-border-subtle bg-background xl:flex"
    >
      <div className="flex flex-1 flex-col justify-between space-y-6 overflow-y-auto p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="type-section-label">
              {playing ? "Now Playing" : "Selected Track"}
            </span>
            {selectedTrack && !playing && (
              <button
                type="button"
                onClick={clearTrack}
                aria-label="Clear selected track"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-text-primary focus-ring"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <Surface
            variant="raised"
            className="flex aspect-square w-full items-center justify-center overflow-hidden border-border-strong bg-surface"
          >
            {artUrl ? (
              <TrackArtwork
                src={artUrl}
                alt={track.name}
                className="h-full w-full"
              />
            ) : (
              <Disc size={40} className="text-text-muted/30" />
            )}
          </Surface>

          <div className="space-y-1">
            <h3 className="text-base font-semibold leading-snug text-text-primary">
              {track.name}
            </h3>
            <p className="text-xs font-medium text-text-secondary">
              {artistName}
            </p>
            {durationLabel && (
              <p className="text-[11px] tabular-nums text-text-muted">
                Duration: {durationLabel}
              </p>
            )}
          </div>

          {track.reason && (
            <div className="space-y-1 rounded-md border border-border-subtle bg-surface p-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">
                Why this track
              </span>
              <p className="text-xs leading-relaxed text-text-secondary">
                {track.reason}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4 border-t border-border-subtle pt-4">
          {notice && (
            <p
              role="status"
              aria-live="polite"
              className="text-center text-[11px] leading-relaxed text-text-muted"
            >
              {notice}
            </p>
          )}

          <div className="space-y-2">
            {action && (
              <PlaybackButton
                playing={playing}
                busy={busy}
                label={
                  busy
                    ? "Starting playback"
                    : playing
                      ? `Pause ${track.name} on Spotify`
                      : actionLabel
                }
                onClick={handlePlayback}
                className="h-10 w-full gap-2 rounded-md px-4 text-xs font-semibold"
              />
            )}
            {spotifyUrl && (
              <a
                href={spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-border-strong px-4 text-xs font-semibold text-text-primary transition-colors hover:bg-surface focus-ring"
              >
                <span>Open in Spotify</span>
                <ExternalLink size={14} />
              </a>
            )}
            {availability === "reconnect-required" && (
              <a
                href="/api/auth/spotify"
                className="inline-flex min-h-10 w-full items-center justify-center rounded-md px-4 text-xs font-semibold text-accent hover:bg-surface focus-ring"
              >
                Reconnect Spotify
              </a>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
