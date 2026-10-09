// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { RecommendationList } from './RecommendationList';
import { NotesBurst } from '@/components/motion/NotesBurst';
import { BeatVisualizer } from '@/components/motion/BeatVisualizer';
import type { ListedTrack } from '@/lib/catalogue/types';
import {
  celebrate,
  claimCelebration,
  resetCelebration,
} from '@/lib/celebrate-store';
import { DEFAULT_UI_PREFS } from '@/lib/ui-prefs';
import { setUiPrefs } from '@/lib/ui-prefs-store';
import { setVibe } from '@/lib/vibe-store';

const sound = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock('@/lib/ui-sound', () => ({
  playSound: (kind: string) => sound.play(kind),
}));
vi.mock('next/dynamic', () => ({
  default: (
    loader: () => Promise<{ default: React.ComponentType<unknown> }>,
  ) => {
    const Lazy = React.lazy(loader);
    return function Dynamic(props: Record<string, unknown>) {
      return (
        <React.Suspense fallback={null}>
          <Lazy {...props} />
        </React.Suspense>
      );
    };
  },
}));

function stubMatchMedia() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

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

describe('the alive recommendation list', () => {
  beforeEach(() => {
    window.localStorage.clear();
    stubMatchMedia();
    setUiPrefs(DEFAULT_UI_PREFS);
    setVibe(null);
    resetCelebration();
    sound.play.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gives every row a vinyl, cover art on the label when a catalogue had one, and a tilting card', () => {
    render(<RecommendationList tracks={TRACKS} title="Slow evening" />);
    const discs = screen.getAllByTestId('vinyl-disc');
    expect(discs).toHaveLength(2);
    expect(discs[0].querySelector('img')).toHaveAttribute(
      'src',
      TRACKS[0].verification?.artworkUrl,
    );
    expect(discs[0].querySelector('img')).toHaveAttribute('loading', 'lazy');
    expect(discs[1].querySelector('img')).toBeNull();
    expect(discs[1].querySelector('.muse-vinyl-label')).not.toBeNull();
    expect(discs[1].style.getPropertyValue('--muse-rise-index')).toBe('1');
    expect(discs[0]).toHaveAttribute('aria-hidden', 'true');

    const rows = screen.getAllByTestId('recommendation-row');
    expect(rows[0].querySelector('.muse-tilt')).not.toBeNull();
    // The why line is the real text, revealed word by word.
    expect(rows[1]).toHaveTextContent('A Lagos story everyone sings along to.');
    expect(
      rows[1].querySelectorAll('[data-testid="word-reveal-word"]').length,
    ).toBeGreaterThan(3);
  });

  it('plays the burst and chime once for a playlist that just arrived, and stays quiet on restore', async () => {
    celebrate();
    render(<RecommendationList tracks={TRACKS} title="Fresh" />);
    expect(await screen.findByTestId('notes-burst')).toBeInTheDocument();
    expect(screen.getByTestId('recommendation-list')).toHaveAttribute(
      'data-arrival',
      'burst',
    );
    expect(sound.play).toHaveBeenCalledWith('arrive');
    expect(claimCelebration()).toBe(false);

    sound.play.mockClear();
    render(<RecommendationList tracks={TRACKS} title="Restored" />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(screen.getAllByTestId('notes-burst')).toHaveLength(1);
    expect(sound.play).not.toHaveBeenCalled();
  });

  it('skips the burst under Lite mode but still chimes when sound is on', async () => {
    setUiPrefs({ lite: 'on', sound: true });
    celebrate();
    render(<RecommendationList tracks={TRACKS} title="Lite" />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(screen.queryByTestId('notes-burst')).toBeNull();
    expect(sound.play).toHaveBeenCalledWith('arrive');
    expect(screen.getByTestId('beat-visualizer-static')).toBeInTheDocument();
  });
});

describe('NotesBurst', () => {
  it('is decorative, draws SVG notes and dots with per-particle directions, and reports when done', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(
      <NotesBurst colours={['#A8E85C', '#FF7A1A']} count={6} onDone={onDone} />,
    );
    const burst = screen.getByTestId('notes-burst');
    expect(burst).toHaveAttribute('aria-hidden', 'true');
    const particles = burst.querySelectorAll('.muse-burst-particle');
    expect(particles).toHaveLength(6);
    expect(burst.querySelectorAll('svg')).toHaveLength(4);
    expect(burst.querySelectorAll('.muse-burst-dot')).toHaveLength(2);
    expect(burst.textContent).toBe('');
    const first = particles[0] as HTMLElement;
    expect(first.style.getPropertyValue('--burst-dx')).toMatch(/px$/);
    expect(first.style.getPropertyValue('--burst-rotate')).toMatch(/deg$/);
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('BeatVisualizer', () => {
  beforeEach(() => {
    window.localStorage.clear();
    stubMatchMedia();
    setUiPrefs(DEFAULT_UI_PREFS);
  });

  it('renders hidden bars under full effects and the plain icon otherwise', () => {
    const { unmount } = render(<BeatVisualizer bars={4} />);
    const live = screen.getByTestId('beat-visualizer');
    expect(live).toHaveAttribute('aria-hidden', 'true');
    expect(live.querySelectorAll('.muse-beat-bar')).toHaveLength(4);
    unmount();

    setUiPrefs({ lite: 'on' });
    render(<BeatVisualizer />);
    expect(screen.getByTestId('beat-visualizer-static')).toBeInTheDocument();
    expect(screen.queryByTestId('beat-visualizer')).toBeNull();
  });
});
