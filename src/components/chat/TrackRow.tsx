"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { ExternalLink, Info, X, Disc } from "lucide-react";
import { transitions, fadeIn, trackRowReveal } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  useNowPlaying,
  formatTrackDuration,
  getSpotifyTrackUrl,
} from "@/hooks/use-now-playing";
import { PlaybackButton } from "@/components/shell/PlaybackButton";
import { EqualizerBars } from "@/components/motion/EqualizerBars";

export interface Track {
  id: string;
  name: string;
  artists: { name: string }[] | string;
  album?: { name?: string; images?: { url: string }[] };
  albumArtUrl?: string;
  duration_ms?: number;
  reason?: string;
  uri?: string;
}

interface TrackRowProps {
  track: Track;
  index: number;
  onRemove?: (id: string) => void;
  listItem?: boolean;
  /**
   * Whether playback is available for this row. Defaults to the real playback
   * availability from the Now Playing context. When false, the row never shows
   * a playing equalizer and offers Open in Spotify on hover instead.
   */
  canPlay?: boolean;
  /** True only while audio is really playing. */
  isPlaying?: boolean;
  /** True while playback is paused on this track. */
  isPaused?: boolean;
  /** Overrides the play and pause action for this row. */
  onTogglePlayback?: () => void;
}

export function TrackRow({
  track,
  index,
  onRemove,
  listItem = false,
  canPlay,
  isPlaying,
  isPaused,
  onTogglePlayback,
}: TrackRowProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const {
    selectedTrack,
    activeTrack,
    playbackMode,
    selectTrack,
    getPlaybackAction,
    playTrack,
    togglePlayback,
    isTrackPlaying,
    isTrackBuffering,
  } = useNowPlaying();

  const artistName = Array.isArray(track.artists)
    ? track.artists.map((artist) => artist.name).join(", ")
    : track.artists;
  const artUrl = track.album?.images?.[0]?.url || track.albumArtUrl;
  const durationLabel = formatTrackDuration(track.duration_ms);
  const spotifyUrl = getSpotifyTrackUrl(track.id);
  const isSelected = selectedTrack?.id === track.id;
  const action = getPlaybackAction(track);
  const busy = isTrackBuffering(track.id);
  const isActiveTrack = activeTrack?.id === track.id && playbackMode !== null;

  const playingNow = isPlaying ?? isTrackPlaying(track.id);
  const pausedNow = isPaused ?? (isActiveTrack && !playingNow);
  const canPlayNow =
    canPlay ?? (action !== null || playingNow || pausedNow || busy);
  // Honesty rule: no equalizer, no playing title, when playback is not real.
  const showEqualizer = canPlayNow && (playingNow || pausedNow);
  const showPlayingTitle = showEqualizer;
  const actionLabel =
    action === "spotify"
      ? `Play ${track.name} on Spotify`
      : `Play ${track.name}`;

  const handlePlayback = () => {
    if (onTogglePlayback) {
      onTogglePlayback();
      return;
    }
    if (isActiveTrack) {
      void togglePlayback();
    } else {
      void playTrack(track);
    }
  };

  return (
    <motion.div
      role={listItem ? "listitem" : undefined}
      variants={trackRowReveal}
      custom={index}
      initial="initial"
      animate="animate"
      className={cn(
        "group border-b border-border-subtle last:border-0",
        isSelected && "rounded-md bg-surface/60",
      )}
    >
      <div className="flex items-center gap-4 rounded-md px-2 py-3 transition-colors hover:bg-surface">
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
          {showEqualizer ? (
            <EqualizerBars
              label={
                pausedNow
                  ? `${track.name} is paused`
                  : `Now playing ${track.name}`
              }
              playing={!pausedNow}
              height={14}
              width={2}
            />
          ) : (
            <>
              <span
                data-testid="track-row-number"
                className="text-xs tabular-nums text-text-muted transition-opacity duration-[140ms] group-hover:opacity-0 group-focus-within:opacity-0"
              >
                {index + 1}
              </span>
              {canPlayNow ? (
                <PlaybackButton
                  playing={playingNow}
                  busy={busy}
                  label={busy ? "Starting playback" : actionLabel}
                  onClick={handlePlayback}
                  className="absolute inset-0 h-8 w-8 opacity-100 transition-opacity duration-[140ms] sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                />
              ) : spotifyUrl ? (
                <a
                  href={spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="track-row-open-in-spotify"
                  aria-label={`Open ${track.name} in Spotify`}
                  title="Open in Spotify"
                  className="absolute inset-0 flex items-center justify-center rounded-full text-text-muted opacity-0 transition-opacity duration-[140ms] group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 hover:text-text-primary"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              ) : null}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => selectTrack(track)}
          className="h-10 w-10 shrink-0 overflow-hidden rounded border border-border-strong bg-surface text-left"
          aria-label={`Select ${track.name}`}
        >
          {artUrl ? (
            <img
              src={artUrl}
              alt={track.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Disc size={14} className="text-text-muted/30" />
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => selectTrack(track)}
          className="min-w-0 flex-1 text-left"
          aria-label={`Inspect ${track.name}`}
        >
          <div
            className={cn(
              "truncate text-sm font-semibold",
              showPlayingTitle ? "text-accent" : "text-text-primary",
            )}
          >
            {track.name}
          </div>
          <div className="truncate text-xs font-medium text-text-secondary">
            {artistName}
          </div>
        </button>

        <span className="hidden w-10 shrink-0 text-right sm:inline-block">
          <span className="text-xs tabular-nums text-text-muted">
            {durationLabel}
          </span>
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="why-this-toggle"
            aria-expanded={isExpanded}
            aria-label={`Why this track: ${track.name}`}
            onClick={() => setIsExpanded((previous) => !previous)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors",
              isExpanded
                ? "bg-accent/15 text-accent"
                : "text-text-muted hover:bg-surface hover:text-text-primary",
            )}
            title="Why this?"
          >
            <Info size={14} />
            <span className="hidden md:inline">Why this</span>
          </button>

          {spotifyUrl && (
            <a
              href={spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${track.name} in Spotify`}
              title="Open in Spotify"
              className="rounded-full p-2 text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
            >
              <ExternalLink size={15} />
            </a>
          )}

          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(track.id)}
              aria-label={`Remove ${track.name}`}
              title="Remove track"
              className="rounded-full p-2 text-text-muted transition-colors hover:bg-surface hover:text-red-400"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            data-testid="why-this-panel"
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.standard}
            className="rounded-b-md bg-surface/30"
          >
            <div className="ml-4 border-l-2 border-accent/30 px-14 pb-4 pt-2 text-sm leading-relaxed text-text-secondary">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-accent/80">
                MUSE Reasoning
              </span>
              {track.reason ||
                "Selected to match the sonic texture, pacing, and mood of your request."}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
