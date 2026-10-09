// @vitest-environment jsdom
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DisplayMenu } from './DisplayMenu';
import { DEFAULT_UI_PREFS, UI_PREFS_STORAGE_KEY } from '@/lib/ui-prefs';
import { setUiPrefs } from '@/lib/ui-prefs-store';

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
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
