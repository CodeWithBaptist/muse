import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TopBar } from './TopBar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings',
}));

describe('TopBar', () => {
  it('offers the wordmark home link and a 44px Settings control', () => {
    render(<TopBar />);
    expect(
      screen.getByRole('link', { name: 'MUSE home' }).getAttribute('href'),
    ).toBe('/');
    const settings = screen.getByRole('link', { name: 'Settings' });
    expect(settings.getAttribute('href')).toBe('/settings');
    expect(settings.getAttribute('aria-current')).toBe('page');
    expect(settings.className).toContain('h-11 w-11');
    expect(settings.className).toContain('focus-ring');
  });

  it('has no menu button, stays in flow, and respects the top safe area', () => {
    render(<TopBar />);
    expect(screen.queryByRole('button')).toBeNull();
    const header = screen.getByRole('banner', { name: 'App header' });
    expect(header.className).not.toContain('fixed');
    expect(header.className).toContain('pt-[var(--muse-safe-top)]');
    expect(header.className).toContain('lg:hidden');
  });
});
