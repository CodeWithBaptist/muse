// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VIBE_CHIPS, VibeChips } from './VibeChips';
import { DEFAULT_UI_PREFS } from '@/lib/ui-prefs';
import { setUiPrefs } from '@/lib/ui-prefs-store';

function stubMatchMedia(matches: Record<string, boolean>) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: Object.entries(matches).some(
        ([key, value]) => value && query.includes(key),
      ),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe('VibeChips', () => {
  const vibrate = vi.fn(() => true);

  beforeEach(() => {
    window.localStorage.clear();
    stubMatchMedia({ 'pointer: fine': true });
    setUiPrefs(DEFAULT_UI_PREFS);
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrate,
      configurable: true,
    });
    vibrate.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the exact chip text and buzzes once', () => {
    const onPick = vi.fn();
    render(<VibeChips onPick={onPick} />);
    const chips = screen.getAllByRole('button');
    expect(chips.map((chip) => chip.textContent)).toEqual([...VIBE_CHIPS]);

    fireEvent.click(chips[0]);
    expect(onPick).toHaveBeenCalledWith('Detty December');
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it('presses down in CSS only, with no ripple layer and no pointer tracking', () => {
    render(<VibeChips onPick={() => undefined} />);
    const chip = screen.getAllByRole('button')[1];
    expect(chip.className).toContain('muse-press');
    fireEvent.pointerMove(chip, {
      clientX: 220,
      clientY: 94,
      pointerType: 'mouse',
    });
    expect(chip.style.transform).toBe('');
    expect(chip.querySelector('[data-testid="ripple"]')).toBeNull();
  });

  it('staggers the rise of each chip through a custom property', () => {
    render(<VibeChips onPick={() => undefined} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0].className).toContain('muse-rise');
    expect(items[0].className).toContain('muse-decorative');
    expect(items[3].style.getPropertyValue('--muse-rise-index')).toBe('3');
  });
});
