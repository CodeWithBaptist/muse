'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrackRow } from '@/components/chat/TrackRow';
import { Surface } from '@/components/ui/Surface';
import { motion } from 'framer-motion';
import { staggerContainer, fadeInUp } from '@/lib/motion';
import { Music, User, Disc, ListMusic, History } from 'lucide-react';
import { cn } from '@/lib/utils';

type LibraryType = 'recent' | 'top-tracks' | 'top-artists' | 'saved-tracks' | 'saved-albums' | 'playlists';

interface LibraryContentProps {
  type: LibraryType;
}

export function LibraryContent({ type }: LibraryContentProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['music', type],
    queryFn: async () => {
      const res = await fetch(`/api/music?type=${type}&limit=40`);
      if (!res.ok) throw new Error('Failed to fetch library content');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="space-y-4 animate-pulse">
            <div className="aspect-square bg-surface rounded-lg" />
            <div className="h-4 bg-surface rounded w-3/4" />
            <div className="h-3 bg-surface rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-text-secondary font-medium">Unable to load library content.</p>
        <p className="text-xs text-text-muted">Make sure your Spotify account is connected.</p>
      </div>
    );
  }

  const items = data?.items || [];

  if (items.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 opacity-40">
        <Music size={48} strokeWidth={1} />
        <div className="space-y-1">
          <p className="font-semibold uppercase tracking-widest text-[10px]">Empty</p>
          <p className="text-sm">Nothing found in this section.</p>
        </div>
      </div>
    );
  }

  // Render list for tracks and recently played
  if (type === 'recent' || type === 'top-tracks' || type === 'saved-tracks') {
    const tracks = type === 'recent' ? items.map((i: any) => i.track) : items.map((i: any) => i.track || i);
    return (
      <motion.div variants={staggerContainer(0.02)} initial="initial" animate="animate" className="space-y-1">
        {tracks.map((track: any, i: number) => (
          <TrackRow key={`${track.id}-${i}`} track={track} index={i} />
        ))}
      </motion.div>
    );
  }

  // Render grid for artists, albums, playlists
  return (
    <motion.div 
      variants={staggerContainer(0.04)} 
      initial="initial" 
      animate="animate"
      className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-8"
    >
      {items.map((item: any, i: number) => {
        const entity = item.track || item.album || item;
        const name = entity.name;
        const sub = entity.artists?.[0]?.name || (type === 'playlists' ? `${entity.tracks.total} tracks` : '');
        const image = entity.images?.[0]?.url || entity.album?.images?.[0]?.url;
        const isArtist = type === 'top-artists';

        return (
          <motion.div 
            key={entity.id || i} 
            variants={fadeInUp}
            whileHover={{ y: -4 }}
            className="group cursor-default"
          >
            <div className={cn(
              "aspect-square overflow-hidden bg-surface border border-border-subtle shadow-md mb-4 transition-all group-hover:border-accent/30 group-hover:shadow-accent/5",
              isArtist ? "rounded-full" : "rounded-lg"
            )}>
              {image ? (
                <img src={image} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-muted/20">
                  {isArtist ? <User size={40} /> : <Disc size={40} />}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold truncate text-text-primary">{name}</p>
              <p className="text-xs font-medium truncate text-text-muted uppercase tracking-tighter">{sub}</p>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
