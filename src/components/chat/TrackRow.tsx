'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, ExternalLink, Info, X, Disc } from 'lucide-react';
import { transitions, fadeIn, fadeInUp } from '@/lib/motion';
import { cn } from '@/lib/utils';
import {
  useNowPlaying,
  formatTrackDuration,
  getSpotifyTrackUrl,
} from '@/hooks/use-now-playing';

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
}

export function TrackRow({ track, index, onRemove }: TrackRowProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const { selectedTrack, selectTrack } = useNowPlaying();

  const artistName = Array.isArray(track.artists)
    ? track.artists.map((a) => a.name).join(', ')
    : track.artists;

  const artUrl = track.album?.images?.[0]?.url || track.albumArtUrl;
  const durationLabel = formatTrackDuration(track.duration_ms);
  const spotifyUrl = getSpotifyTrackUrl(track.id);
  const isSelected = selectedTrack?.id === track.id;

  return (
    <motion.div
      variants={fadeInUp}
      transition={transitions.standard}
      className={cn(
        'group border-b border-border-subtle last:border-0',
        isSelected && 'bg-surface/60 rounded-md'
      )}
    >
      <div className="flex items-center gap-4 py-3 px-2 hover:bg-surface transition-colors rounded-md">
        <div className="w-8 text-xs text-text-muted tabular-nums group-hover:hidden">
          {index + 1}
        </div>
        <button
          type="button"
          onClick={() => selectTrack(track)}
          aria-label={`Inspect ${track.name}`}
          title="Inspect track"
          className="w-8 hidden group-hover:flex items-center justify-center text-accent"
        >
          <Play size={16} fill="currentColor" />
        </button>

        <button
          type="button"
          onClick={() => selectTrack(track)}
          className="w-10 h-10 bg-surface border border-border-strong rounded shrink-0 overflow-hidden text-left"
          aria-label={`Select ${track.name}`}
        >
          {artUrl ? (
            <img
              src={artUrl}
              alt={track.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Disc size={14} className="text-text-muted/30" />
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => selectTrack(track)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="text-sm font-semibold truncate text-text-primary">
            {track.name}
          </div>
          <div className="text-xs font-medium text-text-secondary truncate">
            {artistName}
          </div>
        </button>

        {durationLabel && (
          <span className="hidden sm:inline-block text-xs text-text-muted tabular-nums">
            {durationLabel}
          </span>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="why-this-toggle"
            aria-expanded={isExpanded}
            aria-label={`Why this track: ${track.name}`}
            onClick={() => setIsExpanded((prev) => !prev)}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors',
              isExpanded
                ? 'bg-accent/15 text-accent'
                : 'text-text-muted hover:text-text-primary hover:bg-surface'
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
              className="p-2 text-text-muted hover:text-text-primary transition-colors rounded-full hover:bg-surface"
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
              className="p-2 rounded-full text-text-muted hover:text-red-400 hover:bg-surface transition-colors"
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
            className="bg-surface/30 rounded-b-md"
          >
            <div className="px-14 pb-4 pt-2 text-sm text-text-secondary leading-relaxed border-l-2 border-accent/30 ml-4">
              <span className="text-accent/80 font-semibold uppercase text-[10px] tracking-widest block mb-1">
                MUSE Reasoning
              </span>
              {track.reason ||
                'Selected to match the sonic texture, pacing, and mood of your request.'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
