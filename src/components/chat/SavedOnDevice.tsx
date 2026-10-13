'use client';

import * as React from 'react';
import { Bookmark, ChevronDown, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  clearSavedLists,
  deleteSavedList,
  getSavedLists,
  getServerSavedLists,
  SAVED_LIST_NOTE,
  subscribeSavedLists,
  type SavedList,
} from '@/lib/guest-saved-store';
import { PlaylistActions } from './PlaylistActions';
import { TrackLinks } from './TrackLinks';

/**
 * "Saved on this device": the lists MUSE built for a visitor without an
 * account, kept in this browser only. The panel says plainly where they live
 * and offers the same actions a list has in the conversation (copy, download,
 * share, open-in links), plus deleting one list or clearing all of them.
 */

export function useSavedLists(): readonly SavedList[] {
  return React.useSyncExternalStore(
    subscribeSavedLists,
    getSavedLists,
    getServerSavedLists,
  );
}

/** A short plain date, for example "13 Oct". */
export function savedListDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function SavedOnDeviceButton({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const lists = useSavedLists();
  return (
    <button
      type="button"
      data-testid="saved-on-device-button"
      aria-expanded={open}
      aria-controls="saved-on-device-panel"
      onClick={onToggle}
      className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border-subtle px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
    >
      <Bookmark size={14} aria-hidden="true" />
      <span>Saved on this device ({lists.length})</span>
    </button>
  );
}

function SavedListRow({ list }: { list: SavedList }) {
  const [open, setOpen] = React.useState(false);
  const songsId = React.useId();
  const when = savedListDateLabel(list.savedAt);
  return (
    <li
      data-testid="saved-list-item"
      className="rounded-md border border-border-subtle bg-surface/60 px-3 py-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">
            {list.title}
          </p>
          <p className="text-xs text-text-muted">
            {list.tracks.length} {list.tracks.length === 1 ? 'song' : 'songs'}
            {when ? ` saved ${when}` : ' saved'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => deleteSavedList(list.id)}
          aria-label={`Delete ${list.title}`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-text-muted transition-colors hover:text-danger focus-ring"
        >
          <Trash2 size={14} aria-hidden="true" />
          <span>Delete</span>
        </button>
      </div>

      <PlaylistActions
        title={list.title}
        tracks={list.tracks}
        className="pt-2"
      />

      <button
        type="button"
        aria-expanded={open}
        aria-controls={songsId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md text-xs font-semibold text-text-secondary transition-colors hover:text-text-primary focus-ring"
      >
        {open ? 'Hide songs' : 'Songs and open-in links'}
        <ChevronDown
          size={12}
          aria-hidden="true"
          className={cn('transition-transform', open && 'rotate-180')}
        />
      </button>
      <div id={songsId} hidden={!open} className="space-y-2 pt-2">
        {list.tracks.map((track, index) => (
          <div key={`${track.id}-${index}`} className="space-y-1">
            <p className="text-xs text-text-primary">
              <span className="text-text-muted">{index + 1}. </span>
              {track.title}{' '}
              <span className="text-text-secondary">by {track.artist}</span>
            </p>
            <TrackLinks track={track} />
          </div>
        ))}
      </div>
    </li>
  );
}

export function SavedOnDevicePanel() {
  const lists = useSavedLists();
  const [cleared, setCleared] = React.useState(false);

  const clearAll = () => {
    clearSavedLists();
    setCleared(true);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p
          data-testid="saved-on-device-note"
          className="text-xs leading-relaxed text-text-muted"
        >
          {SAVED_LIST_NOTE}
        </p>
        {lists.length > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex min-h-9 items-center rounded-md px-2 text-xs font-semibold text-text-muted transition-colors hover:text-danger focus-ring"
          >
            Clear all
          </button>
        ) : null}
      </div>

      {lists.length === 0 ? (
        <p className="py-2 text-xs text-text-muted">
          {cleared
            ? 'Cleared. Every saved list has been removed from this browser.'
            : 'Nothing saved yet. Lists MUSE builds for you are kept here.'}
        </p>
      ) : (
        <ul data-testid="saved-list" className="space-y-2">
          {lists.map((list) => (
            <SavedListRow key={list.id} list={list} />
          ))}
        </ul>
      )}
    </div>
  );
}
