'use client';

import * as React from 'react';
import { motion } from 'motion/react';
import { Logo } from '@/components/ui/Logo';
import { TrackRow } from './TrackRow';
import { PlaylistPreview } from './PlaylistPreview';
import { WordReveal } from './WordReveal';
import { fadeIn, fadeInUp, transitions } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { SpotifyTrackItem } from '@/lib/validation/api-schemas';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tracks?: SpotifyTrackItem[];
  isPlaylistSuggestion?: boolean;
  isStreaming?: boolean;
  noResults?: boolean;
}

export function ChatMessage({ message }: { message: Message }) {
  const isAssistant = message.role === 'assistant';
  const [removedTrackIds, setRemovedTrackIds] = React.useState<Set<string>>(
    () => new Set()
  );

  const localTracks = React.useMemo(() => {
    const source = message.tracks ?? [];
    if (removedTrackIds.size === 0) return source;
    return source.filter((t) => !removedTrackIds.has(t.id));
  }, [message.tracks, removedTrackIds]);

  const handleRemoveTrack = (id: string) => {
    setRemovedTrackIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      transition={transitions.standard}
      className={cn(
        'flex flex-col gap-4 max-w-3xl',
        isAssistant ? 'mr-auto' : 'ml-auto text-right'
      )}
    >
      {isAssistant && (
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-sm bg-surface border border-border-subtle flex items-center justify-center overflow-hidden">
            <Logo variant="mark" size={14} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            MUSE
          </span>
        </div>
      )}

      <motion.div
        variants={fadeIn}
        initial="initial"
        animate="animate"
        transition={transitions.standard}
        className={cn(
          'p-4 text-sm leading-relaxed font-medium',
          isAssistant
            ? 'bg-transparent text-text-primary border-l border-border-strong pl-6'
            : 'bg-accent/5 text-text-primary rounded-2xl rounded-tr-none border border-accent/10 px-6'
        )}
      >
        {isAssistant ? (
          <WordReveal text={message.content} />
        ) : (
          <span>{message.content}</span>
        )}
      </motion.div>

      {isAssistant && message.noResults && localTracks.length === 0 && (
        <div
          data-testid="chat-no-results-state"
          className="ml-6 p-4 rounded-lg bg-surface border border-border-subtle text-xs text-text-secondary space-y-1"
        >
          <p className="font-semibold text-text-primary uppercase tracking-wider text-[10px]">
            No matching tracks found
          </p>
          <p>
            Spotify search did not return tracks for those exact criteria. Try naming a specific artist, era, or broader genre.
          </p>
        </div>
      )}

      {isAssistant && localTracks.length > 0 && (
        <div className="mt-2">
          {message.isPlaylistSuggestion ? (
            <PlaylistPreview
              tracks={localTracks}
              onRemoveTrack={handleRemoveTrack}
            />
          ) : (
            <div role="list" aria-label="Recommended tracks" className="space-y-1">
              {localTracks.map((track, i) => (
                <TrackRow
                  key={track.id || i}
                  track={track}
                  index={i}
                  listItem
                />
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
