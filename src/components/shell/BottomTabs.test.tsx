import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BottomTabs } from './BottomTabs';
import { PRIMARY_NAV } from './shell-nav';

const pathname = vi.hoisted(() => ({ value: '/discover' }));
const auth = vi.hoisted(() => ({ authenticated: true }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.value,
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: null,
    authenticated: auth.authenticated,
    isLoading: false,
    logout: async () => ({ ok: true }),
  }),
}));

describe('BottomTabs', () => {
  beforeEach(() => {
    auth.authenticated = true;
    pathname.value = '/discover';
  });

  it('gives a guest the two open destinations, chat and profile, and nothing else', () => {
    auth.authenticated = false;
    render(<BottomTabs />);
    const nav = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(
      Array.from(nav.querySelectorAll('a')).map((a) => a.textContent),
    ).toEqual(['Chat', 'Profile']);
  });

  it('renders all six authenticated destinations as 44px tabs with focus rings', () => {
    render(<BottomTabs />);
    const nav = screen.getByRole('navigation', { name: 'Primary navigation' });
    const links = nav.querySelectorAll('a');
    expect(links).toHaveLength(PRIMARY_NAV.length + 1);
    for (const link of links) {
      expect(link.className).toContain('min-h-11');
      expect(link.className).toContain('focus-ring');
    }
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
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

  it('fixes the bar below md and pads for the home indicator', () => {
    render(<BottomTabs />);
    const nav = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(nav.className).toContain('fixed');
    expect(nav.className).toContain('md:hidden');
    expect(nav.className).toContain('pb-[var(--muse-safe-bottom)]');
  });
});
