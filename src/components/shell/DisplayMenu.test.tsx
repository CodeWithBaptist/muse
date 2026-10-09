// @vitest-environment jsdom
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('opens from one labelled button, applies theme and Lite at once, and closes on Escape', async () => {
    render(<DisplayMenu />);
    const trigger = screen.getByRole('button', { name: 'Display settings' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('display-menu')).toBeNull();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const dialog = screen.getByRole('dialog', { name: 'Display settings' });
    expect(dialog).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-controls', dialog.id);

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
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('shows the display controls in a bounded modal sheet below 640px', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(max-width: 639px)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );

    render(<DisplayMenu />);
    const trigger = screen.getByRole('button', { name: 'Display settings' });
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', {
      name: 'Display settings',
    });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.className).toContain('fixed inset-x-4 bottom-0');
    expect(dialog.className).toContain('max-w-[calc(100vw-2rem)]');
    expect(dialog.style.maxHeight).toContain('70dvh');
    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'Lite mode' }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Close display settings' }),
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
