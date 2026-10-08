import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BottomTabs } from './BottomTabs';
import { PRIMARY_NAV } from './shell-nav';

const pathname = vi.hoisted(() => ({ value: '/discover' }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.value,
}));

describe('BottomTabs', () => {
  it('renders the five destinations as 44px tabs with focus rings', () => {
    render(<BottomTabs />);
    const nav = screen.getByRole('navigation', { name: 'Primary navigation' });
    const links = nav.querySelectorAll('a');
    expect(links).toHaveLength(PRIMARY_NAV.length);
    for (const link of links) {
      expect(link.className).toContain('min-h-11');
      expect(link.className).toContain('focus-ring');
    }
    expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull();
  });

  it('marks the active tab with aria-current and a visible indicator', () => {
    render(<BottomTabs />);
    const discover = screen.getByRole('link', { name: 'Discover' });
    expect(discover.getAttribute('aria-current')).toBe('page');
    expect(discover.querySelector('[data-tab-indicator]')).not.toBeNull();

    const chat = screen.getByRole('link', { name: 'Chat' });
    expect(chat.getAttribute('aria-current')).toBeNull();
    expect(chat.querySelector('[data-tab-indicator]')).toBeNull();
  });

  it('keeps the bar in flow, hides it from lg up, and pads for the home indicator', () => {
    render(<BottomTabs />);
    const nav = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(nav.className).not.toContain('fixed');
    expect(nav.className).toContain('lg:hidden');
    expect(nav.className).toContain('pb-[var(--muse-safe-bottom)]');
  });
});
