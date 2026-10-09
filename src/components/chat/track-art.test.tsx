// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecommendationList } from './RecommendationList';
import type { ListedTrack } from '@/lib/catalogue/types';

const TRACKS: ListedTrack[] = [
  {
    id: 't1',
    title: 'Essence',
    artist: 'Wizkid',
    why: 'Smooth, warm, and built for a slow evening.',
    region: 'Nigeria',
    verification: {
      status: 'verified',
      source: 'deezer',
      id: '1',
      url: 'https://www.deezer.com/track/1',
      artworkUrl:
        'https://e-cdns-images.dzcdn.net/images/cover/abc/56x56-000000-80-0-0.jpg',
    },
  },
  {
    id: 't2',
    title: 'Ojuelegba',
    artist: 'Wizkid',
    why: 'A Lagos story everyone sings along to.',
    region: 'Nigeria',
    verification: { status: 'unverified', reason: 'title_not_found' },
  },
];

describe('track art in the recommendation list', () => {
  it('shows real cover art when a catalogue returned one and a letter when it did not', () => {
    render(<RecommendationList tracks={TRACKS} title="Slow evening" />);
    const art = screen.getByTestId('track-art');
    expect(art).toHaveAttribute('src', TRACKS[0].verification?.artworkUrl);
    expect(art).toHaveAttribute('loading', 'lazy');
    expect(art).toHaveAttribute('alt', '');

    const initial = screen.getByTestId('track-art-initial');
    expect(initial).toHaveTextContent('O');
    expect(initial).toHaveAttribute('aria-hidden', 'true');
    expect(document.querySelector('img[src*="vinyl"], .muse-vinyl')).toBeNull();

    const rows = screen.getAllByTestId('recommendation-row');
    expect(rows[1]).toHaveTextContent('A Lagos story everyone sings along to.');
  });
});
