'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { fadeInUp, tileHover, tileHoverTransition } from '@/lib/motion';
import { Disc, ExternalLink } from 'lucide-react';
import { useNowPlaying, getSpotifyTrackUrl } from '@/hooks/use-now-playing';
import type { SpotifyTrackItem } from '@/lib/validation/api-schemas';

interface DiscoverSectionProps {
  title: string;
  description: string;
  tracks: SpotifyTrackItem[];
}

export function DiscoverSection({
  title,
  description,
  tracks,
}: DiscoverSectionProps) {
  const { selectTrack } = useNowPlaying();
  const shouldReduceMotion = useReducedMotion() ?? false;

  if (tracks.length === 0) return null;

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
        <p className="type-caption font-medium">{description}</p>
      </div>

      <div className="relative group">
        <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide -mx-2 px-2 snap-x">
          {tracks.map((track, i) => {
            const image = track.album?.images?.[0]?.url || track.albumArtUrl;
            const spotifyUrl = getSpotifyTrackUrl(track.id);
            return (
              <motion.div
                key={track.id + i}
                variants={fadeInUp}
                initial="initial"
                whileInView="animate"
                viewport={{ once: true }}
                whileHover={shouldReduceMotion ? undefined : tileHover}
                transition={tileHoverTransition}
                className="w-40 md:w-48 shrink-0 space-y-3 snap-start"
              >
                <button
                  type="button"
                  onClick={() => selectTrack(track)}
                  className="w-full aspect-square bg-surface border border-border-subtle rounded-lg overflow-hidden transition-colors hover:border-border-strong block text-left"
                  aria-label={`Inspect ${track.name}`}
                >
                  {image ? (
                    <img
                      src={image}
                      alt={track.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-muted/20">
                      <Disc size={40} />
                    </div>
                  )}
                </button>
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => selectTrack(track)}
                    className="space-y-1 min-w-0 flex-1 text-left"
                  >
                    <p className="text-sm font-semibold truncate text-text-primary">
                      {track.name}
                    </p>
                    <p className="text-xs font-medium truncate text-text-muted uppercase tracking-tighter">
                      {track.artists?.[0]?.name}
                    </p>
                  </button>
                  {spotifyUrl && (
                    <a
                      href={spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${track.name} in Spotify`}
                      title="Open in Spotify"
                      className="p-1.5 text-text-muted hover:text-text-primary transition-colors shrink-0"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
