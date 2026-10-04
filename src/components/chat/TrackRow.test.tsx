import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TrackRow } from './TrackRow';

const TRACK = {
  id: '3n3Ppam7vgaVa1iaRUc9Lp',
  name: 'Midnight Signal',
  artists: [{ name: 'Solange' }],
  duration_ms: 215000,
  uri: 'spotify:track:3n3Ppam7vgaVa1iaRUc9Lp',
};

function renderRow(props: Partial<React.ComponentProps<typeof TrackRow>> = {}) {
  return render(
    <TrackRow track={TRACK} index={0} listItem {...props} />,
  );
}

describe('TrackRow playback props', () => {
  it('shows the row number and an Open in Spotify action when playback is unavailable', () => {
    renderRow({ canPlay: false });

    expect(screen.getByTestId('track-row-number').textContent).toBe('1');
    expect(screen.getByText('3:35')).toBeDefined();
    expect(screen.queryByTestId('equalizer')).toBeNull();
    expect(
      screen.queryByRole('button', { name: /play midnight signal/i }),
    ).toBeNull();

    const openLink = screen.getByTestId('track-row-open-in-spotify');
    expect(openLink).toHaveAttribute(
      'href',
      'https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp',
    );
    expect(openLink).toHaveAttribute('target', '_blank');
  });

  it('never shows the playing equalizer when canPlay is false, even if isPlaying is set', () => {
    renderRow({ canPlay: false, isPlaying: true });

    expect(screen.queryByTestId('equalizer')).toBeNull();
    expect(screen.getByTestId('track-row-number')).toBeDefined();
  });

  it('shows a three bar equalizer, the playing title color, and no row number while playing', () => {
    renderRow({ canPlay: true, isPlaying: true });

    const equalizer = screen.getByTestId('equalizer');
    expect(equalizer).toHaveAttribute('data-paused', 'false');
    expect(equalizer).toHaveAttribute('aria-label', 'Now playing Midnight Signal');
    expect(screen.getAllByTestId('equalizer-bar')).toHaveLength(3);

    expect(screen.queryByTestId('track-row-number')).toBeNull();
    expect(screen.getByText('Midnight Signal').className).toContain(
      'text-accent',
    );
  });

  it('freezes the equalizer while paused and keeps it in place', () => {
    renderRow({ canPlay: true, isPaused: true });

    const equalizer = screen.getByTestId('equalizer');
    expect(equalizer).toHaveAttribute('data-paused', 'true');
    expect(equalizer).toHaveAttribute(
      'aria-label',
      'Midnight Signal is paused',
    );
    expect(screen.getAllByTestId('equalizer-bar')).toHaveLength(3);
    expect(screen.getByText('Midnight Signal').className).toContain(
      'text-accent',
    );
  });

  it('removes the equalizer again when playback ends', () => {
    renderRow({ canPlay: true, isPlaying: false, isPaused: false });

    expect(screen.queryByTestId('equalizer')).toBeNull();
    expect(screen.getByTestId('track-row-number').textContent).toBe('1');
  });

  it('offers a play control through the playback toggle when playback is available', () => {
    const onTogglePlayback = vi.fn();
    renderRow({ canPlay: true, onTogglePlayback });

    expect(
      screen.getByRole('button', { name: /play midnight signal/i }),
    ).toBeDefined();
    expect(screen.queryByTestId('track-row-open-in-spotify')).toBeNull();
  });
});
