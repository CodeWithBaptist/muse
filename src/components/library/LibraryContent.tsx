'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrackRow } from '@/components/chat/TrackRow';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { motion, useReducedMotion } from 'motion/react';
import {
  staggerContainer,
  fadeInUp,
  tileHover,
  tileHoverTransition,
} from '@/lib/motion';
import { Music, User, Disc, Link2Off, RefreshCw, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SpotifyTrackItem } from '@/lib/validation/api-schemas';
import type { LibraryType, TimeRangeType } from '@/app/(app)/library/page';

interface LibraryContentProps {
  type: LibraryType;
  timeRange?: TimeRangeType;
}

interface LibraryEntity {
  id?: string;
  name: string;
  artists?: Array<{ name: string }>;
  tracks?: { total: number };
  images?: Array<{ url: string }>;
  album?: { images?: Array<{ url: string }> };
}

interface LibraryWrapperItem extends LibraryEntity {
  track?: SpotifyTrackItem & LibraryEntity;
  album?: LibraryEntity;
}

interface ApiError extends Error {
  code?: string;
  status?: number;
}

export function LibraryContent({
  type,
  timeRange = 'medium_term',
}: LibraryContentProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['music', type, timeRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        type,
        limit: '40',
        timeRange,
      });
      const res = await fetch(`/api/music?${params.toString()}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const err: ApiError = new Error(
          errBody.error || 'Failed to fetch library content'
        );
        err.code = errBody.code;
        err.status = res.status;
        throw err;
      }
      return res.json();
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        className="grid grid-cols-2 gap-6 md:grid-cols-4 lg:grid-cols-5"
      >
        <p role="status" className="sr-only">
          Loading library items.
        </p>
        {[...Array(10)].map((_, i) => (
          <div key={i} className="space-y-4">
            <div className="aspect-square bg-surface rounded-lg" />
            <div className="h-4 bg-surface rounded w-3/4" />
            <div className="h-3 bg-surface rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  const apiError = error as ApiError | null;
  const isSpotifyDisconnected =
    apiError?.status === 401 ||
    apiError?.code === 'SPOTIFY_RECONNECT_REQUIRED' ||
    apiError?.code === 'SPOTIFY_DISCONNECTED';

  if (isSpotifyDisconnected) {
    return (
      <Surface
        data-testid="library-spotify-disconnected"
        className="p-12 text-center space-y-4 border-dashed border-border-strong bg-transparent rounded-2xl max-w-2xl"
      >
        <div className="w-10 h-10 rounded-full bg-surface border border-border-subtle flex items-center justify-center mx-auto">
          <Link2Off size={18} className="text-accent" />
        </div>
        <p className="text-text-primary font-semibold">
          Spotify connection required
        </p>
        <p className="text-xs text-text-secondary max-w-md mx-auto">
          Reconnect your Spotify account to view your listening history, saved
          tracks, top artists, and playlists.
        </p>
        <div className="pt-2">
          <Button
            variant="primary"
            onClick={() => {
              window.location.href = '/api/auth/spotify';
            }}
          >
            Reconnect Spotify
          </Button>
        </div>
      </Surface>
    );
  }

  if (error) {
    return (
      <Surface className="p-12 text-center space-y-4 border-dashed border-border-strong bg-transparent rounded-2xl max-w-2xl">
        <p className="text-text-primary font-semibold">
          Unable to load library content
        </p>
        <p className="text-xs text-text-muted">
          {(error as Error).message}
        </p>
        <div className="pt-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw size={14} className="mr-2" />
            Try again
          </Button>
        </div>
      </Surface>
    );
  }

  const items: LibraryWrapperItem[] = data?.items || [];

  if (items.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
        <Music size={48} strokeWidth={1} />
        <div className="space-y-1">
          <p className="font-semibold uppercase tracking-widest text-[10px]">
            Empty
          </p>
          <p className="text-sm text-text-secondary">
            Nothing found in this section yet.
          </p>
        </div>
      </div>
    );
  }

  if (type === 'recent' || type === 'top-tracks' || type === 'saved-tracks') {
    const tracks: SpotifyTrackItem[] =
      type === 'recent'
        ? items
            .map((i) => i.track)
            .filter((t): t is SpotifyTrackItem & LibraryEntity => Boolean(t))
        : items.map((i) => (i.track || i) as unknown as SpotifyTrackItem);
    return (
      <motion.div
        role="list"
        aria-label="Spotify tracks"
        variants={staggerContainer(0.02)}
        initial="initial"
        animate="animate"
        className="space-y-1"
      >
        {tracks.map((track, i) => (
          <TrackRow
            key={`${track.id}-${i}`}
            track={track}
            index={i}
            listItem
          />
        ))}
      </motion.div>
    );
  }

  const externalKind =
    type === 'top-artists'
      ? 'artist'
      : type === 'saved-albums'
        ? 'album'
        : 'playlist';

  return (
    <motion.div
      variants={staggerContainer(0.04)}
      initial="initial"
      animate="animate"
      className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-8"
    >
      {items.map((item, i) => {
        const entity: LibraryEntity = item.track || item.album || item;
        const name = entity.name;
        const sub =
          entity.artists?.[0]?.name ||
          (type === 'playlists' && entity.tracks
            ? `${entity.tracks.total} tracks`
            : '');
        const image =
          entity.images?.[0]?.url || entity.album?.images?.[0]?.url;
        const isArtist = type === 'top-artists';
        const spotifyUrl = entity.id
          ? `https://open.spotify.com/${externalKind}/${encodeURIComponent(entity.id)}`
          : null;

        return (
          <motion.div
            key={entity.id || i}
            variants={fadeInUp}
            whileHover={shouldReduceMotion ? undefined : tileHover}
            transition={tileHoverTransition}
            className="group"
          >
            <div
              className={cn(
                'aspect-square overflow-hidden bg-surface border border-border-subtle mb-4 transition-colors group-hover:border-accent/40',
                isArtist ? 'rounded-full' : 'rounded-lg'
              )}
            >
              {image ? (
                <img
                  src={image}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-muted/20">
                  {isArtist ? <User size={40} /> : <Disc size={40} />}
                </div>
              )}
            </div>
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0 flex-1">
                <p className="text-sm font-semibold truncate text-text-primary">
                  {name}
                </p>
                <p className="text-xs font-medium truncate text-text-muted uppercase tracking-tighter">
                  {sub}
                </p>
              </div>
              {spotifyUrl && (
                <a
                  href={spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${name} in Spotify`}
                  title="Open in Spotify"
                  className="p-1 text-text-muted hover:text-text-primary transition-colors shrink-0"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
