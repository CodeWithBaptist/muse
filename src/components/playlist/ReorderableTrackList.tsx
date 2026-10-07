'use client';

import * as React from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { GripVertical } from 'lucide-react';
import { transitions } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * A track list the visitor can put in a different order.
 *
 * Dragging uses Motion's Reorder primitive with the spring the motion system
 * already defines, so the movement matches section 19 without introducing a
 * second spring alongside the existing one.
 *
 * Drag alone would not be usable by keyboard, and on touch it competes with
 * scrolling, so the handle is a real button that also moves the row with the
 * arrow keys. It is 40px square, which is the minimum touch target. Both paths
 * call the same callback, so there is one source of truth for the new order and
 * no way for the two to disagree.
 *
 * Generic over the track type because the surfaces that need it store tracks in
 * different shapes, and duplicating this per surface would mean two lists that
 * drift apart.
 */

export interface ReorderableTrackListProps<T> {
  tracks: T[];
  onReorder: (tracks: T[]) => void;
  getKey: (track: T) => string;
  /** Used in the control label and the announcement, so it should name the track. */
  getLabel: (track: T) => string;
  renderTrack: (track: T, index: number) => React.ReactNode;
  ariaLabel: string;
  className?: string;
}

export function ReorderableTrackList<T>({
  tracks,
  onReorder,
  getKey,
  getLabel,
  renderTrack,
  ariaLabel,
  className,
}: ReorderableTrackListProps<T>) {
  const move = React.useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= tracks.length || from === to) return;
      const next = [...tracks];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      onReorder(next);
    },
    [onReorder, tracks]
  );

  return (
    <Reorder.Group
      axis="y"
      values={tracks}
      onReorder={onReorder}
      as="div"
      role="list"
      aria-label={ariaLabel}
      className={cn('space-y-1', className)}
    >
      {tracks.map((track, index) => (
        <ReorderableRow
          key={getKey(track)}
          track={track}
          index={index}
          count={tracks.length}
          label={getLabel(track)}
          renderTrack={renderTrack}
          onMove={move}
        />
      ))}
    </Reorder.Group>
  );
}

interface ReorderableRowProps<T> {
  track: T;
  index: number;
  count: number;
  label: string;
  renderTrack: (track: T, index: number) => React.ReactNode;
  onMove: (from: number, to: number) => void;
}

function ReorderableRow<T>({
  track,
  index,
  count,
  label,
  renderTrack,
  onMove,
}: ReorderableRowProps<T>) {
  const controls = useDragControls();
  const [announcement, setAnnouncement] = React.useState('');

  const atTop = index === 0;
  const atBottom = index === count - 1;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    let to: number | null = null;

    if (event.key === 'ArrowUp') to = index - 1;
    else if (event.key === 'ArrowDown') to = index + 1;
    else if (event.key === 'Home') to = 0;
    else if (event.key === 'End') to = count - 1;

    if (to === null || to < 0 || to >= count || to === index) return;

    event.preventDefault();
    onMove(index, to);
    setAnnouncement(`${label} moved to position ${to + 1} of ${count}.`);
  };

  return (
    <Reorder.Item
      value={track}
      as="div"
      role="listitem"
      dragListener={false}
      dragControls={controls}
      transition={transitions.spring}
      className="flex items-center gap-1 rounded-md border border-border-transparent transition-colors hover:border-border-subtle"
    >
      <button
        type="button"
        data-testid="reorder-handle"
        aria-label={`Reorder ${label}. Position ${index + 1} of ${count}. Use the arrow keys to move it.`}
        aria-keyshortcuts="ArrowUp ArrowDown Home End"
        onPointerDown={(event) => controls.start(event)}
        onKeyDown={handleKeyDown}
        disabled={count < 2}
        className={cn(
          'flex h-10 w-10 shrink-0 touch-none items-center justify-center rounded-md',
          'text-text-muted transition-colors hover:text-text-primary focus-ring',
          'cursor-grab active:cursor-grabbing disabled:cursor-default disabled:opacity-40'
        )}
      >
        <GripVertical size={16} aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">{renderTrack(track, index)}</div>

      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>

      {/* Honest end-of-list state rather than a control that does nothing. */}
      <span aria-hidden="true" className="sr-only">
        {atTop ? 'First in the list.' : ''}
        {atBottom ? 'Last in the list.' : ''}
      </span>
    </Reorder.Item>
  );
}
