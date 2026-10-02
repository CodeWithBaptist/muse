'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Check, ExternalLink, X, GripVertical } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TrackRow } from '@/components/chat/TrackRow';
import { transitions, fadeInUp, staggerContainer } from '@/lib/motion';

interface Track {
  id: string;
  name: string;
  artists: any;
  uri: string;
  album?: any;
}

interface PlaylistPreviewProps {
  tracks: Track[];
  onRemoveTrack: (id: string) => void;
  suggestedName?: string;
  suggestedDescription?: string;
}

export function PlaylistPreview({ 
  tracks, 
  onRemoveTrack,
  suggestedName = "New MUSE Mix",
  suggestedDescription = "Curated based on our conversation."
}: PlaylistPreviewProps) {
  const [name, setName] = React.useState(suggestedName);
  const [description, setDescription] = React.useState(suggestedDescription);
  const [status, setStatus] = React.useState<'idle' | 'creating' | 'success' | 'error'>('idle');
  const [spotifyUrl, setSpotifyUrl] = React.useState<string | null>(null);

  const handleExport = async () => {
    setStatus('creating');
    try {
      const res = await fetch('/api/playlists/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          trackUris: tracks.map(t => t.uri),
        }),
      });

      if (!res.ok) throw new Error('Failed to create playlist');
      
      const data = await res.json();
      setSpotifyUrl(data.spotifyUrl);
      setStatus('success');
    } catch (e) {
      setStatus('error');
    }
  };

  return (
    <Surface variant="raised" className="p-6 space-y-6 overflow-hidden border-accent/20 bg-accent/[0.02]">
      <div className="flex items-start gap-6">
        <div className="w-24 h-24 md:w-32 md:h-24 bg-surface border border-border-strong rounded-lg flex items-center justify-center shrink-0">
          <Music className="text-accent/20" size={32} />
        </div>
        <div className="flex-1 space-y-3 min-w-0">
          <div className="space-y-1">
             <label className="type-section-label">Playlist Name</label>
             <input 
               value={name}
               onChange={e => setName(e.target.value)}
               className="w-full bg-transparent border-none p-0 text-xl font-bold focus:ring-0 text-text-primary placeholder:text-text-muted"
               placeholder="Enter playlist name"
             />
          </div>
          <div className="space-y-1">
             <label className="type-section-label">Description</label>
             <textarea 
               value={description}
               onChange={e => setDescription(e.target.value)}
               className="w-full bg-transparent border-none p-0 text-sm text-text-secondary focus:ring-0 resize-none h-12 leading-relaxed"
               placeholder="Add a description"
             />
          </div>
        </div>
      </div>

      <div className="border-t border-border-subtle pt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="type-section-label">{tracks.length} Tracks</h3>
        </div>
        
        <motion.div variants={staggerContainer(0.04)} className="space-y-1">
          {tracks.map((track, i) => (
            <div key={track.id} className="relative group/track">
              <TrackRow track={track} index={i} />
              <button 
                onClick={() => onRemoveTrack(track.id)}
                className="absolute right-12 top-1/2 -translate-y-1/2 p-2 rounded-full opacity-0 group-hover/track:opacity-100 hover:bg-surface transition-all text-text-muted hover:text-red-400"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="pt-4 border-t border-border-subtle flex flex-col sm:flex-row gap-4">
        {status === 'idle' && (
          <Button 
            className="w-full sm:w-auto"
            onClick={handleExport}
            disabled={tracks.length === 0}
          >
            Create in Spotify
          </Button>
        )}
        
        {status === 'creating' && (
          <Button disabled className="w-full sm:w-auto opacity-70">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="mr-2"
            >
              <Music size={16} />
            </motion.div>
            Creating...
          </Button>
        )}

        {status === 'success' && (
          <Button 
            variant="primary"
            className="w-full sm:w-auto bg-accent text-background"
            onClick={() => spotifyUrl && window.open(spotifyUrl, '_blank')}
          >
            <Check size={16} className="mr-2" />
            Open in Spotify
          </Button>
        )}

        {status === 'error' && (
          <Button 
            variant="outline"
            className="w-full sm:w-auto border-red-500/50 text-red-500"
            onClick={handleExport}
          >
            Failed. Try again?
          </Button>
        )}
        
        <Button variant="ghost" className="w-full sm:w-auto" onClick={() => window.location.reload()}>
          Start Over
        </Button>
      </div>
    </Surface>
  );
}
