'use client';

import * as React from 'react';
import { motion } from 'motion/react';
import { ListMusic } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import { fadeInUp, transitions } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { RecommendedTrack, RegionTag } from '@/lib/ai/playlist-engine';

/**
 * The list MUSE builds for visitors without an account: title, artist, one
 * line on why, and a region tag per song. The list is honest about what it
 * is; a note explains that the picks have not been checked against a
 * catalogue yet, which later work replaces with real verification badges.
 */

const REGION_STYLES: Record<RegionTag, string> = {
  Nigeria: 'border-accent/40 bg-accent/10 text-accent',
  Africa: 'border-border-strong bg-surface text-text-primary',
  Global: 'border-border-subtle bg-transparent text-text-secondary',
};

export function RegionBadge({ region }: { region: RegionTag }) {
  return (
    <span
      data-region={region}
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[10px] font-semibold uppercase tracking-wider',
        REGION_STYLES[region],
      )}
    >
      {region}
    </span>
  );
}

export interface RecommendationListProps {
  tracks: RecommendedTrack[];
  title?: string;
  /** True when MUSE returned fewer songs than it aims for. */
  short?: boolean;
}

export function RecommendationList({
  tracks,
  title,
  short,
}: RecommendationListProps) {
  const headingId = React.useId();
  if (tracks.length === 0) return null;

  return (
    <Surface
      variant="raised"
      data-testid="recommendation-list"
      aria-labelledby={headingId}
      className="overflow-hidden border-accent/20 bg-accent/[0.02]"
    >
      <div className="flex items-start gap-4 border-b border-border-subtle px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface">
          <ListMusic size={18} className="text-accent" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            id={headingId}
            className="truncate text-base font-bold text-text-primary"
          >
            {title || 'MUSE mix'}
          </h3>
          <p className="text-xs font-medium text-text-secondary">
            {tracks.length} {tracks.length === 1 ? 'song' : 'songs'}
            {short ? ', only the ones MUSE was sure about' : ''}
          </p>
        </div>
      </div>

      <ol
        role="list"
        aria-label={title || 'Recommended songs'}
        className="divide-y divide-border-subtle"
      >
        {tracks.map((track, index) => (
          <motion.li
            key={track.id}
            data-testid="recommendation-row"
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{
              ...transitions.standard,
              delay: Math.min(index * 0.04, 0.4),
            }}
            className="flex gap-4 px-5 py-3.5"
          >
            <span className="w-6 shrink-0 pt-0.5 text-right text-xs tabular-nums text-text-muted">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-semibold text-text-primary">
                  {track.title}
                </span>
                <span className="text-xs font-medium text-text-secondary">
                  {track.artist}
                </span>
                <RegionBadge region={track.region} />
              </div>
              <p className="text-sm leading-relaxed text-text-secondary">
                {track.why}
              </p>
            </div>
          </motion.li>
        ))}
      </ol>

      <p className="border-t border-border-subtle px-5 py-3 text-xs leading-relaxed text-text-muted">
        Picked by MUSE from what it knows. These have not been checked against a
        music catalogue yet, so a title or credit may be off.
      </p>
    </Surface>
  );
}
