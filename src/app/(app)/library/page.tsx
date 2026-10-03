'use client';

import * as React from 'react';
import { LibraryContent } from '@/components/library/LibraryContent';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

type LibraryType = 'recent' | 'top-tracks' | 'top-artists' | 'saved-tracks' | 'saved-albums' | 'playlists';

const TABS: { id: LibraryType; label: string }[] = [
  { id: 'recent', label: 'Recently Played' },
  { id: 'top-artists', label: 'Top Artists' },
  { id: 'top-tracks', label: 'Top Tracks' },
  { id: 'saved-tracks', label: 'Saved Tracks' },
  { id: 'saved-albums', label: 'Saved Albums' },
  { id: 'playlists', label: 'Playlists' },
];

export default function LibraryPage() {
  const [activeTab, setActiveTab] = React.useState<LibraryType>('recent');

  return (
    <div className="p-8 space-y-10 min-h-full">
      <div className="space-y-6">
        <h1 className="type-page-title">Library</h1>
        
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-border-subtle">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap",
                activeTab === tab.id 
                  ? "bg-accent text-background" 
                  : "text-text-muted hover:text-text-primary hover:bg-surface"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="pb-20"
      >
        <LibraryContent type={activeTab} />
      </motion.div>
    </div>
  );
}
