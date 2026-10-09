// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VIBE_CHIPS, VibeChips } from './VibeChips';
import { DEFAULT_UI_PREFS } from '@/lib/ui-prefs';
import { setUiPrefs } from '@/lib/ui-prefs-store';

const sound = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock('@/lib/ui-sound', () => ({
  playSound: (kind: string) => sound.play(kind),
}));

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
    sound.play.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the exact chip text, buzzes once, and asks for a tap sound', () => {
    const onPick = vi.fn();
    render(<VibeChips onPick={onPick} />);
    const chips = screen.getAllByRole('button');
    expect(chips.map((chip) => chip.textContent)).toEqual([...VIBE_CHIPS]);

    fireEvent.click(chips[0]);
    expect(onPick).toHaveBeenCalledWith('Detty December');
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(10);
    expect(sound.play).toHaveBeenCalledWith('tap');
  });

  it('ripples where it is pressed and leans toward a mouse, but only with full effects', () => {
    render(<VibeChips onPick={() => undefined} />);
    const chip = screen.getAllByRole('button')[1];
    chip.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 50,
        width: 120,
        height: 44,
        right: 220,
        bottom: 94,
      }) as DOMRect;

    fireEvent.pointerDown(chip, { clientX: 130, clientY: 60 });
    const ripple = screen.getByTestId('ripple');
    expect(ripple.style.left).toBe('30px');
    expect(ripple.style.top).toBe('10px');
    expect(ripple.style.width).toBe('240px');

    fireEvent.pointerMove(chip, {
      clientX: 220,
      clientY: 94,
      pointerType: 'mouse',
    });
    expect(chip.style.transform).toBe('translate3d(5.0px, 4.8px, 0)');
    fireEvent.pointerLeave(chip);
    expect(chip.style.transform).toBe('');

    fireEvent.pointerMove(chip, {
      clientX: 220,
      clientY: 94,
      pointerType: 'touch',
    });
    expect(chip.style.transform).toBe('');

    setUiPrefs({ lite: 'on' });
    const liteChip = screen.getAllByRole('button')[2];
    fireEvent.pointerDown(liteChip, { clientX: 5, clientY: 5 });
    fireEvent.pointerMove(liteChip, {
      clientX: 220,
      clientY: 94,
      pointerType: 'mouse',
    });
    expect(liteChip.querySelector('[data-testid="ripple"]')).toBeNull();
    expect(liteChip.style.transform).toBe('');
  });

  it('staggers the rise of each chip through a custom property', () => {
    render(<VibeChips onPick={() => undefined} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0].className).toContain('muse-rise');
    expect(items[0].className).toContain('muse-decorative');
    expect(items[3].style.getPropertyValue('--muse-rise-index')).toBe('3');
  });
});
