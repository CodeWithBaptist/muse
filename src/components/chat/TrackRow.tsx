'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Plus, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { transitions, fadeInUp } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface Track {
  id: string;
  name: string;
  artists: { name: string }[] | string;
  album?: { images: { url: string }[] };
  albumArtUrl?: string;
  duration_ms?: number;
  reason?: string;
}

export function TrackRow({ track, index }: { track: Track; index: number }) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const artistName = Array.isArray(track.artists) 
    ? track.artists.map(a => a.name).join(', ') 
    : track.artists;
  
  const artUrl = track.album?.images?.[0]?.url || track.albumArtUrl;

  return (
    <motion.div
      variants={fadeInUp}
      whileHover={{ x: 4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="group border-b border-border-subtle last:border-0"
    >
      <div className="flex items-center gap-4 py-3 px-2 hover:bg-surface transition-colors rounded-md cursor-default">
        <div className="w-8 text-xs text-text-muted tabular-nums group-hover:hidden">
          {index + 1}
        </div>
        <button className="w-8 hidden group-hover:flex items-center justify-center text-accent">
          <Play size={16} fill="currentColor" />
        </button>

        <div className="w-10 h-10 bg-surface border border-border-strong rounded shrink-0 overflow-hidden">
          {artUrl ? (
            <img src={artUrl} alt={track.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Plus size={12} className="text-text-muted/20" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate text-text-primary">
            {track.name}
          </div>
          <div className="text-xs font-medium text-text-secondary truncate">
            {artistName}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "p-2 rounded-full hover:bg-surface transition-colors",
              isExpanded ? "text-accent" : "text-text-muted hover:text-text-primary"
            )}
            title="Why this?"
          >
            <Info size={16} />
          </button>
          <button className="p-2 text-text-muted hover:text-text-primary transition-colors">
            <Plus size={16} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transitions.standard}
            className="overflow-hidden bg-surface/30 rounded-b-md"
          >
            <div className="px-14 pb-4 pt-2 text-sm text-text-secondary leading-relaxed border-l-2 border-accent/30 ml-4">
              <span className="text-accent/60 font-medium uppercase text-[10px] tracking-widest block mb-1">MUSE Reasoning</span>
              {track.reason || "This track matches the sonic profile and mood you described."}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
