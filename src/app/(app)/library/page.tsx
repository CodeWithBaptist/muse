'use client';

import * as React from 'react';
import { LibraryContent } from '@/components/library/LibraryContent';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { fadeIn, transitions } from '@/lib/motion';

export type LibraryType =
  | 'recent'
  | 'top-tracks'
  | 'top-artists'
  | 'saved-tracks'
  | 'saved-albums'
  | 'playlists';

export type TimeRangeType = 'short_term' | 'medium_term' | 'long_term';

const TABS: { id: LibraryType; label: string }[] = [
  { id: 'recent', label: 'Recently Played' },
  { id: 'top-artists', label: 'Top Artists' },
  { id: 'top-tracks', label: 'Top Tracks' },
  { id: 'saved-tracks', label: 'Saved Tracks' },
  { id: 'saved-albums', label: 'Saved Albums' },
  { id: 'playlists', label: 'Playlists' },
];

const TIME_RANGES: { id: TimeRangeType; label: string }[] = [
  { id: 'short_term', label: 'Last 4 weeks' },
  { id: 'medium_term', label: 'Last 6 months' },
  { id: 'long_term', label: 'All time' },
];

export default function LibraryPage() {
  const [activeTab, setActiveTab] = React.useState<LibraryType>('recent');
  const [timeRange, setTimeRange] = React.useState<TimeRangeType>('medium_term');

  const supportsTimeRange =
    activeTab === 'top-artists' || activeTab === 'top-tracks';

  return (
    <div className="p-8 space-y-10 min-h-full">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <h1 className="type-page-title">Library</h1>

          {supportsTimeRange && (
            <div
              role="group"
              aria-label="Time range"
              className="inline-flex items-center gap-1 p-1 rounded-lg bg-surface border border-border-subtle self-start"
            >
              {TIME_RANGES.map((range) => (
                <button
                  key={range.id}
                  type="button"
                  aria-pressed={timeRange === range.id}
                  onClick={() => setTimeRange(range.id)}
                  className={cn(
                    'px-3 py-1 rounded text-xs font-medium transition-colors',
                    timeRange === range.id
                      ? 'bg-accent text-background font-semibold'
                      : 'text-text-secondary hover:text-text-primary'
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          role="group"
          aria-label="Library sections"
          className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-border-subtle"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-accent text-background'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        key={`${activeTab}-${supportsTimeRange ? timeRange : 'default'}`}
        variants={fadeIn}
        initial="initial"
        animate="animate"
        transition={transitions.standard}
        className="pb-20"
      >
        <LibraryContent type={activeTab} timeRange={timeRange} />
      </motion.div>
    </div>
  );
}
