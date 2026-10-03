'use client';

import * as React from 'react';
import { motion } from 'motion/react';
import { Logo } from '@/components/ui/Logo';
import { TrackRow } from './TrackRow';
import { PlaylistPreview } from './PlaylistPreview';
import { staggerContainer } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tracks?: any[];
  isPlaylistSuggestion?: boolean;
}

export function ChatMessage({ message }: { message: Message }) {
  const isAssistant = message.role === 'assistant';
  const [localTracks, setLocalTracks] = React.useState(message.tracks || []);

  const handleRemoveTrack = (id: string) => {
    setLocalTracks(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className={cn(
      "flex flex-col gap-4 max-w-3xl",
      isAssistant ? "mr-auto" : "ml-auto text-right"
    )}>
      {isAssistant && (
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-sm bg-surface border border-border-subtle flex items-center justify-center overflow-hidden">
            <Logo variant="mark" size={14} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">MUSE</span>
        </div>
      )}

      <div className={cn(
        "p-4 text-sm leading-relaxed font-medium",
        isAssistant 
          ? "bg-transparent text-text-primary border-l border-border-strong pl-6" 
          : "bg-accent/5 text-text-primary rounded-2xl rounded-tr-none border border-accent/10 px-6"
      )}>
        {message.content}
      </div>

      {isAssistant && localTracks.length > 0 && (
        <div className="mt-2">
          {message.isPlaylistSuggestion ? (
             <PlaylistPreview 
               tracks={localTracks} 
               onRemoveTrack={handleRemoveTrack}
             />
          ) : (
            <motion.div
              variants={staggerContainer(0.04)}
              initial="initial"
              animate="animate"
              className="space-y-1"
            >
              {localTracks.map((track, i) => (
                <TrackRow key={track.id || i} track={track} index={i} />
              ))}
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
