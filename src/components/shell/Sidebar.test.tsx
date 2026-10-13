import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';
import { PRIMARY_NAV } from './shell-nav';

const auth = vi.hoisted(() => ({ authenticated: true }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/playlists/abc123',
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: auth.authenticated
      ? { displayName: 'Ada', email: 'ada@example.com', avatarUrl: null }
      : null,
    authenticated: auth.authenticated,
    isLoading: false,
    logout: async () => ({ ok: true }),
  }),
}));

describe('Sidebar', () => {
  beforeEach(() => {
    auth.authenticated = true;
  });

  it('renders every destination plus Settings, all at least 40px tall with focus rings', () => {
    render(<Sidebar />);
    for (const item of PRIMARY_NAV) {
      const link = screen.getByRole('link', { name: item.label });
      expect(link.getAttribute('href')).toBe(item.href);
      expect(link.className).toContain('min-h-10');
      expect(link.className).toContain('focus-ring');
    }
    expect(
      screen.getByRole('link', { name: 'Settings' }).getAttribute('href'),
    ).toBe('/settings');
  });

  it('marks the current section as active, including nested routes', () => {
    render(<Sidebar />);
    const playlists = screen.getByRole('link', { name: 'Playlists' });
    expect(playlists.getAttribute('aria-current')).toBe('page');
    expect(playlists.className).toContain('text-text-primary');

    const discover = screen.getByRole('link', { name: 'Discover' });
    expect(discover.getAttribute('aria-current')).toBeNull();
    expect(discover.className).toContain('text-text-secondary');
  });

  it('labels the chat destination as a place, not as a new chat action', () => {
    render(<Sidebar />);
    expect(screen.queryByText('New chat')).toBeNull();
    expect(screen.getByRole('link', { name: 'Chat' })).toBeDefined();
  });

  it('uses the layout token for its width and hides below md', () => {
    render(<Sidebar />);
    const aside = screen.getByRole('complementary', {
      name: 'Application sidebar',
    });
    expect(aside.className).toContain('w-[var(--muse-sidebar-width)]');
    expect(aside.className).toContain('hidden');
    expect(aside.className).toContain('md:flex');
  });

  it('gives a visitor Chat and Profile only, with no account chip, sign in, or log out', () => {
    auth.authenticated = false;
    render(<Sidebar />);
    expect(
      screen.getByRole('link', { name: 'Chat' }).getAttribute('href'),
    ).toBe('/chat');
    expect(
      screen.getByRole('link', { name: 'Profile' }).getAttribute('href'),
    ).toBe('/profile');
    for (const item of PRIMARY_NAV.filter((entry) => !entry.open)) {
      expect(screen.queryByRole('link', { name: item.label })).toBeNull();
    }
    // No account surface of any kind, and no empty stand-in heading either.
    expect(screen.queryByText('Guest')).toBeNull();
    expect(screen.queryByText('Chat stays on this device')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull();
    expect(
      screen.queryByRole('navigation', { name: 'Account navigation' }),
    ).toBeNull();
    expect(screen.queryByText(/Sign in|Create account|Log in/)).toBeNull();
    // Display settings stay, so a guest keeps theme and Lite mode.
    expect(
      screen.getByRole('button', { name: 'Display settings' }),
    ).toBeDefined();
  });
});
