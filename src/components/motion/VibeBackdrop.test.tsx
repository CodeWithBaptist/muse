// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { VibeBackdrop } from './VibeBackdrop';
import { DEFAULT_UI_PREFS } from '@/lib/ui-prefs';
import { setUiPrefs } from '@/lib/ui-prefs-store';
import { setVibe } from '@/lib/vibe-store';

function stubMatchMedia(reducedMotion: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reducedMotion && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe('VibeBackdrop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    stubMatchMedia(false);
    setUiPrefs(DEFAULT_UI_PREFS);
    setVibe(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is decorative, follows the prompt, and crossfades palettes instead of jumping', () => {
    render(<VibeBackdrop />);
    const backdrop = screen.getByTestId('vibe-backdrop');
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    expect(backdrop).toHaveAttribute('data-vibe', 'muse');
    expect(backdrop.querySelectorAll('.muse-vibe-layer')).toHaveLength(1);

    act(() => setVibe('Gym grind'));
    expect(backdrop).toHaveAttribute('data-vibe', 'grind');
    const layers = backdrop.querySelectorAll('.muse-vibe-layer');
    expect(layers).toHaveLength(2);
    expect(layers[1]).toHaveAttribute('data-entering', 'true');
    expect((layers[1] as HTMLElement).style.getPropertyValue('--vibe-a')).toBe(
      '#FF3B30',
    );

    // jsdom has no AnimationEvent, so the timer fallback settles the fade here.
    act(() => {
      vi.advanceTimersByTime(1700);
    });
    expect(backdrop.querySelectorAll('.muse-vibe-layer')).toHaveLength(1);
    expect(backdrop.querySelector('.muse-vibe-layer')).not.toHaveAttribute('data-entering');
  });

  it('renders nothing under Lite mode or reduced motion', () => {
    setUiPrefs({ lite: 'on' });
    const { unmount } = render(<VibeBackdrop />);
    expect(screen.queryByTestId('vibe-backdrop')).toBeNull();
    unmount();

    setUiPrefs({ lite: 'off' });
    stubMatchMedia(true);
    render(<VibeBackdrop />);
    expect(screen.queryByTestId('vibe-backdrop')).toBeNull();
  });
});
