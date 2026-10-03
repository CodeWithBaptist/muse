'use client';

import * as React from 'react';
import { motion } from 'motion/react';
import { Music, Check, RotateCcw, BookmarkPlus } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { TrackRow, type Track } from '@/components/chat/TrackRow';
import { staggerContainer } from '@/lib/motion';

interface PlaylistPreviewProps {
  tracks: Track[];
  onRemoveTrack: (id: string) => void;
  suggestedName?: string;
  suggestedDescription?: string;
}

export function PlaylistPreview({
  tracks,
  onRemoveTrack,
  suggestedName = 'New MUSE Mix',
  suggestedDescription = 'Curated based on our conversation.',
}: PlaylistPreviewProps) {
  const [name, setName] = React.useState(suggestedName);
  const [description, setDescription] = React.useState(suggestedDescription);
  const [status, setStatus] = React.useState<
    'idle' | 'creating' | 'success' | 'error'
  >('idle');
  const [draftStatus, setDraftStatus] = React.useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [spotifyUrl, setSpotifyUrl] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const buildTrackPayload = () =>
    tracks.map((t) => ({
      id: t.id,
      title: t.name,
      artist: Array.isArray(t.artists)
        ? t.artists.map((a) => a.name).join(', ')
        : t.artists,
      albumArtUrl: t.album?.images?.[0]?.url || t.albumArtUrl || null,
      durationMs: t.duration_ms ?? 180_000,
    }));

  const handleExport = async () => {
    const trimmedName = name.trim() || 'New MUSE Mix';
    const trackUris = tracks
      .map((t) => t.uri || (t.id ? `spotify:track:${t.id.replace(/^spotify:track:/, '')}` : null))
      .filter((u): u is string => Boolean(u));

    setStatus('creating');
    setErrorMessage(null);
    try {
      const res = await fetch('/api/playlists/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim(),
          trackUris,
          tracks: buildTrackPayload(),
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Failed to create playlist');
      }

      const data = await res.json();
      setSpotifyUrl(data.spotifyUrl);
      setStatus('success');
    } catch (e: unknown) {
      setErrorMessage(
        e instanceof Error ? e.message : 'Unable to export playlist right now.'
      );
      setStatus('error');
    }
  };

  const handleSaveDraft = async () => {
    const trimmedName = name.trim() || 'New MUSE Mix';
    setDraftStatus('saving');
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim(),
          tracks: buildTrackPayload(),
        }),
      });

      if (!res.ok) throw new Error('Failed to save playlist draft');
      setDraftStatus('saved');
    } catch {
      setDraftStatus('error');
    }
  };

  const handleResetEdits = () => {
    setName(suggestedName);
    setDescription(suggestedDescription);
    setErrorMessage(null);
    if (status === 'error') {
      setStatus('idle');
    }
  };

  return (
    <Surface
      variant="raised"
      data-testid="playlist-preview"
      className="p-6 space-y-6 overflow-hidden border-accent/20 bg-accent/[0.02]"
    >
      <div className="flex items-start gap-6">
        <div className="w-20 h-20 md:w-28 md:h-24 bg-surface border border-border-strong rounded-lg flex items-center justify-center shrink-0">
          <Music className="text-accent/30" size={28} />
        </div>
        <div className="flex-1 space-y-3 min-w-0">
          <div className="space-y-1">
            <label htmlFor="playlist-name-input" className="type-section-label">
              Playlist Name
            </label>
            <input
              id="playlist-name-input"
              aria-label="Playlist Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface/60 border border-border-subtle rounded px-3 py-1.5 text-lg font-bold focus:outline-none focus:border-accent text-text-primary placeholder:text-text-muted"
              placeholder="Enter playlist name"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="playlist-description-input"
              className="type-section-label"
            >
              Description
            </label>
            <textarea
              id="playlist-description-input"
              aria-label="Playlist Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-surface/60 border border-border-subtle rounded px-3 py-1.5 text-sm text-text-secondary focus:outline-none focus:border-accent resize-none h-14 leading-relaxed"
              placeholder="Add a description"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border-subtle pt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="type-section-label">{tracks.length} Tracks</h3>
          <span className="text-xs text-text-muted">
            Edit title or remove tracks before exporting
          </span>
        </div>

        {tracks.length === 0 ? (
          <p className="py-6 text-sm text-text-muted text-center">
            All tracks have been removed from this playlist preview.
          </p>
        ) : (
          <motion.div variants={staggerContainer(0.04)} className="space-y-1">
            {tracks.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i}
                onRemove={onRemoveTrack}
              />
            ))}
          </motion.div>
        )}
      </div>

      {errorMessage && (
        <p className="text-xs text-red-400 font-medium">{errorMessage}</p>
      )}

      <div className="pt-4 border-t border-border-subtle flex flex-wrap gap-3">
        {status === 'idle' && (
          <Button
            className="w-full sm:w-auto"
            onClick={handleExport}
            disabled={tracks.length === 0 || !name.trim()}
          >
            Create in Spotify
          </Button>
        )}

        {status === 'creating' && (
          <Button disabled className="w-full sm:w-auto opacity-70">
            <Music size={16} className="mr-2" />
            Creating in Spotify...
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
            className="w-full sm:w-auto border-red-500/50 text-red-400"
            onClick={handleExport}
          >
            Export failed. Try again
          </Button>
        )}

        <Button
          variant="outline"
          className="w-full sm:w-auto"
          disabled={tracks.length === 0 || draftStatus === 'saving' || draftStatus === 'saved'}
          onClick={handleSaveDraft}
        >
          <BookmarkPlus size={15} className="mr-2" />
          {draftStatus === 'saved'
            ? 'Saved to Playlists'
            : draftStatus === 'saving'
              ? 'Saving...'
              : 'Save to MUSE Playlists'}
        </Button>

        <Button
          variant="ghost"
          className="w-full sm:w-auto"
          onClick={handleResetEdits}
        >
          <RotateCcw size={14} className="mr-2" />
          Reset Title
        </Button>
      </div>
    </Surface>
  );
}
