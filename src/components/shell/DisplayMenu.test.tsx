// @vitest-environment jsdom
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DisplayMenu } from './DisplayMenu';
import { DEFAULT_UI_PREFS, UI_PREFS_STORAGE_KEY } from '@/lib/ui-prefs';
import { setUiPrefs } from '@/lib/ui-prefs-store';

const sound = vi.hoisted(() => ({ preview: vi.fn() }));
vi.mock('@/lib/ui-sound', () => ({ previewSound: () => sound.preview() }));

describe('DisplayMenu', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    setUiPrefs(DEFAULT_UI_PREFS);
    sound.preview.mockReset();
  });

  it('opens from one labelled button, applies theme and Lite at once, and closes on Escape', () => {
    render(<DisplayMenu />);
    const trigger = screen.getByRole('button', { name: 'Display settings' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('display-menu')).toBeNull();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const dialog = screen.getByRole('dialog', { name: 'Display settings' });
    expect(dialog).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const lite = screen.getByTestId('display-lite');
    fireEvent.click(
      lite.querySelector('button:nth-child(2)') as HTMLButtonElement,
    );
    expect(document.documentElement.getAttribute('data-effects')).toBe('lite');
    expect(
      JSON.parse(window.localStorage.getItem(UI_PREFS_STORAGE_KEY) ?? ''),
    ).toEqual({
      theme: 'light',
      lite: 'on',
      sound: false,
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps sound off by default and plays one preview only when it is switched on', () => {
    render(<DisplayMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Display settings' }));
    const group = screen.getByTestId('display-sound');
    const [off, on] = Array.from(group.querySelectorAll('button'));
    expect(off).toHaveAttribute('aria-pressed', 'true');
    expect(sound.preview).not.toHaveBeenCalled();

    fireEvent.click(on);
    expect(sound.preview).toHaveBeenCalledTimes(1);
    fireEvent.click(off);
    expect(sound.preview).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(window.localStorage.getItem(UI_PREFS_STORAGE_KEY) ?? '').sound,
    ).toBe(false);
  });
});
