import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReorderableTrackList } from './ReorderableTrackList';

/**
 * The reorderable list.
 *
 * Dragging cannot be exercised in jsdom, so these tests cover the keyboard
 * path, which is the half that has to work for anyone who cannot drag. Both
 * paths call the same callback, so proving the callback receives a correct
 * permutation covers the contract the drag path shares.
 */

interface Row {
  id: string;
  name: string;
}

const TRACKS: Row[] = [
  { id: 'a', name: 'Night Drive' },
  { id: 'b', name: 'Harmattan' },
  { id: 'c', name: 'Slow Burn' },
];

function renderList(props?: { tracks?: Row[] }) {
  const onReorder = vi.fn<(tracks: Row[]) => void>();

  render(
    <ReorderableTrackList
      tracks={props?.tracks ?? TRACKS}
      onReorder={onReorder}
      getKey={(track) => track.id}
      getLabel={(track) => track.name}
      ariaLabel="Tracks in playlist"
      renderTrack={(track) => <span>{track.name}</span>}
    />
  );

  return { onReorder };
}

function handleFor(name: string) {
  return screen.getByRole('button', {
    name: new RegExp(`Reorder ${name}`),
  });
}

describe('ReorderableTrackList', () => {
  it('moves a row down with the arrow key', () => {
    const { onReorder } = renderList();

    fireEvent.keyDown(handleFor('Night Drive'), { key: 'ArrowDown' });

    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder.mock.calls[0][0].map((track) => track.id)).toEqual([
      'b',
      'a',
      'c',
    ]);
  });

  it('moves a row up with the arrow key', () => {
    const { onReorder } = renderList();

    fireEvent.keyDown(handleFor('Slow Burn'), { key: 'ArrowUp' });

    expect(onReorder.mock.calls[0][0].map((track) => track.id)).toEqual([
      'a',
      'c',
      'b',
    ]);
  });

  it('jumps to the ends with Home and End', () => {
    const { onReorder } = renderList();

    fireEvent.keyDown(handleFor('Slow Burn'), { key: 'Home' });
    expect(onReorder.mock.calls[0][0].map((track) => track.id)).toEqual([
      'c',
      'a',
      'b',
    ]);

    fireEvent.keyDown(handleFor('Night Drive'), { key: 'End' });
    expect(onReorder.mock.calls[1][0].map((track) => track.id)).toEqual([
      'b',
      'c',
      'a',
    ]);
  });

  it('does nothing when a row is already at the end it was pushed towards', () => {
    const { onReorder } = renderList();

    fireEvent.keyDown(handleFor('Night Drive'), { key: 'ArrowUp' });
    fireEvent.keyDown(handleFor('Slow Burn'), { key: 'ArrowDown' });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('ignores keys that are not reorder commands', () => {
    const { onReorder } = renderList();

    fireEvent.keyDown(handleFor('Night Drive'), { key: 'ArrowLeft' });
    fireEvent.keyDown(handleFor('Night Drive'), { key: 'Enter' });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('announces the new position for screen readers', () => {
    renderList();

    fireEvent.keyDown(handleFor('Night Drive'), { key: 'ArrowDown' });

    expect(
      screen.getByText('Night Drive moved to position 2 of 3.')
    ).toBeDefined();
  });

  it('tells the visitor where the row is before they move it', () => {
    renderList();

    expect(handleFor('Harmattan').getAttribute('aria-label')).toContain(
      'Position 2 of 3'
    );
    expect(handleFor('Harmattan').getAttribute('aria-keyshortcuts')).toBe(
      'ArrowUp ArrowDown Home End'
    );
  });

  it('disables the handle when there is nothing to reorder', () => {
    renderList({ tracks: [{ id: 'a', name: 'Only Track' }] });

    expect(handleFor('Only Track')).toHaveProperty('disabled', true);
  });

  it('gives every handle a touch target at the 40px minimum', () => {
    renderList();

    // The class list is the assertion here because the sizing is what section
    // 13 requires and jsdom has no layout to measure.
    expect(handleFor('Night Drive').className).toContain('h-10');
    expect(handleFor('Night Drive').className).toContain('w-10');
  });

  it('renders a list with one listitem per track', () => {
    renderList();

    expect(screen.getByRole('list', { name: 'Tracks in playlist' })).toBeDefined();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});
