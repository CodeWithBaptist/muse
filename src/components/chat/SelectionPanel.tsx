'use client';

import * as React from 'react';
import { AnimatePresence } from 'motion/react';
import { TrackRow, type Track } from './TrackRow';
import { PlaylistPreview } from './PlaylistPreview';
import type { SpotifyTrackItem } from '@/lib/validation/api-schemas';
import type { RefinementSummary } from '@/hooks/use-chat';

/**
 * The living recommendation list.
 *
 * One list, edited in place across refinement turns, rather than a new list per
 * reply. Section 26 asks that rows which still fit stay where they are, new
 * rows enter with the standard stagger, and removed rows collapse. That is only
 * possible if the rows belong to a single persistent component with stable
 * keys, so this sits after the message stream instead of inside a message.
 *
 * Keeping it here also keeps the list next to the input, which is where an
 * iterative refinement conversation is actually happening.
 */

interface SelectionPanelProps {
  tracks: SpotifyTrackItem[];
  refinement?: RefinementSummary;
  isPlaylistSuggestion?: boolean;
  suggestedPlaylistName?: string;
  suggestedPlaylistDescription?: string;
  noResults?: boolean;
  /** Reports row removals upward, so the next refinement knows what is on screen. */
  onTracksChange?: (tracks: SpotifyTrackItem[]) => void;
}

export function SelectionPanel({
  tracks,
  refinement,
  isPlaylistSuggestion,
  suggestedPlaylistName,
  suggestedPlaylistDescription,
  noResults,
  onTracksChange,
}: SelectionPanelProps) {
  const [removedIds, setRemovedIds] = React.useState<Set<string>>(
    () => new Set()
  );

  // A new selection from the server replaces the list wholesale, so removals
  // recorded against the previous selection no longer apply. The signature is
  // sorted on purpose: reordering the same rows is not a new selection, and
  // clearing the visitor's removals because they moved a row would be wrong.
  const signature = tracks
    .map((track) => track.id)
    .slice()
    .sort()
    .join('|');
  const [lastSignature, setLastSignature] = React.useState(signature);
  if (signature !== lastSignature) {
    setLastSignature(signature);
    if (removedIds.size > 0) setRemovedIds(new Set());
  }

  const visibleTracks = React.useMemo(() => {
    if (removedIds.size === 0) return tracks;
    return tracks.filter((track) => !removedIds.has(track.id));
  }, [tracks, removedIds]);

  /**
   * Reordering the playlist preview changes the order the parent holds.
   *
   * The new order is mapped back onto the objects this panel already has rather
   * than passed through, which keeps the types honest and means a row cannot
   * arrive from the child carrying data this panel never had.
   */
  const handleReorder = (next: Track[]) => {
    const byId = new Map(tracks.map((track) => [track.id, track]));
    const reordered = next
      .map((track) => byId.get(track.id))
      .filter((track): track is SpotifyTrackItem => track !== undefined);
    onTracksChange?.(reordered);
  };

  const handleRemove = (id: string) => {
    setRemovedIds((previous) => {
      const next = new Set(previous);
      next.add(id);
      return next;
    });
    onTracksChange?.(tracks.filter((track) => track.id !== id));
  };

  if (tracks.length === 0 && !noResults) return null;

  return (
    <section
      aria-label="Current recommendation"
      className="mr-auto w-full max-w-3xl"
    >
      {refinement && (
        <p
          data-testid="refinement-summary"
          className="mb-3 flex flex-wrap items-baseline gap-2 text-[11px] leading-relaxed text-text-muted"
        >
          <span className="type-section-label text-accent">Refined</span>
          <span>{refinement.summary}</span>
          <span aria-hidden="true">
            {refinement.keptTracks > 0
              ? ` ${refinement.keptTracks} kept`
              : ''}
            {refinement.newTracks > 0 ? ` ${refinement.newTracks} new` : ''}
            {refinement.removedTracks > 0
              ? ` ${refinement.removedTracks} removed`
              : ''}
          </span>
        </p>
      )}

      {noResults && visibleTracks.length === 0 ? (
        <div
          data-testid="chat-no-results-state"
          className="p-4 rounded-lg bg-surface border border-border-subtle text-xs text-text-secondary space-y-1"
        >
          <p className="font-semibold text-text-primary uppercase tracking-wider text-[10px]">
            No matching tracks found
          </p>
          <p>
            Spotify search did not return tracks for those exact criteria. Try
            naming a specific artist, era, or broader genre.
          </p>
        </div>
      ) : isPlaylistSuggestion ? (
        <PlaylistPreview
          tracks={visibleTracks}
          onRemoveTrack={handleRemove}
          onReorderTracks={onTracksChange ? handleReorder : undefined}
          suggestedName={suggestedPlaylistName}
          suggestedDescription={suggestedPlaylistDescription}
        />
      ) : (
        <div
          role="list"
          aria-label="Recommended tracks"
          className="space-y-1 rounded-lg border border-border-subtle bg-surface/40 p-1"
        >
          {/* Surviving rows keep their key, so Motion holds them in place while
              new rows enter with the stagger TrackRow already applies and
              removed rows collapse out. popLayout takes a leaving row out of
              flow at once so the rows below move up during the fade. */}
          <AnimatePresence initial={false} mode="popLayout">
            {visibleTracks.map((track, index) => (
              <TrackRow
                key={track.id || index}
                track={track}
                index={index}
                onRemove={handleRemove}
                listItem
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
