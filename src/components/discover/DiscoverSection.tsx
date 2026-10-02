'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer } from '@/lib/motion';
import { Disc, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiscoverSectionProps {
  title: string;
  description: string;
  tracks: any[];
}

export function DiscoverSection({ title, description, tracks }: DiscoverSectionProps) {
  if (tracks.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="type-display text-2xl">{title}</h2>
        <p className="type-caption font-medium opacity-80">{description}</p>
      </div>

      <div className="relative group">
        <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide -mx-2 px-2 snap-x">
          {tracks.map((track, i) => {
            const image = track.album?.images?.[0]?.url;
            return (
              <motion.div
                key={track.id + i}
                variants={fadeInUp}
                initial="initial"
                whileInView="animate"
                viewport={{ once: true }}
                whileHover={{ y: -4 }}
                className="w-40 md:w-48 shrink-0 space-y-3 snap-start"
              >
                <div className="aspect-square bg-surface border border-border-subtle rounded-lg overflow-hidden shadow-md group-hover:shadow-lg transition-all">
                  {image ? (
                    <img src={image} alt={track.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-muted/20">
                      <Disc size={40} />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold truncate text-text-primary">{track.name}</p>
                  <p className="text-xs font-medium truncate text-text-muted uppercase tracking-tighter">
                    {track.artists?.[0]?.name}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
