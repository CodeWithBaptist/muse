import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NowPlayingProvider } from '@/hooks/use-now-playing';
import { AppShell } from './AppShell';

const navigation = vi.hoisted(() => ({
  pathname: '/chat',
  push: vi.fn(),
  replace: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  authenticated: true,
  isLoading: false,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: auth.authenticated
      ? { displayName: 'Ada', email: 'ada@example.com' }
      : null,
    authenticated: auth.authenticated,
    isLoading: auth.isLoading,
    logout: async () => {},
  }),
}));

vi.mock('motion/react', async () => {
  const { motionMock } = await import('@/test/motion-mock');
  return motionMock;
});

function renderShell(children: React.ReactNode = <p>Page body</p>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NowPlayingProvider>
        <AppShell>{children}</AppShell>
      </NowPlayingProvider>
    </QueryClientProvider>,
  );
}

describe('AppShell', () => {
  beforeEach(() => {
    navigation.pathname = '/chat';
    navigation.push.mockReset();
    navigation.replace.mockReset();
    auth.authenticated = true;
    auth.isLoading = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response('{}', {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lays out sidebar, page column, and rail with nothing fixed over the page', () => {
    const { container } = renderShell();

    expect(
      screen.getByRole('complementary', { name: 'Application sidebar' }),
    ).toBeDefined();
    expect(screen.getByRole('banner', { name: 'App header' })).toBeDefined();
    expect(screen.getByRole('main').textContent).toContain('Page body');
    expect(screen.getByTestId('now-playing-panel')).toBeDefined();
    // Empty strip renders nothing, so no space is taken from the page.
    expect(screen.queryByTestId('now-playing-strip')).toBeNull();

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('muse-shell');
    expect(root.className).not.toContain('h-screen');

    // Both navigations exist: the sidebar for lg+, the tabs below it.
    const navs = screen.getAllByRole('navigation', {
      name: 'Primary navigation',
    });
    expect(navs).toHaveLength(2);
    const fixed = Array.from(
      container.querySelectorAll('[class*="fixed"]'),
    ).filter((element) => !element.className.includes('sr-only'));
    expect(fixed).toHaveLength(0);
  });

  it('keeps the skip link first and makes the main landmark focusable', () => {
    const { container } = renderShell();
    const first = container.querySelector('a');
    expect(first?.getAttribute('href')).toBe('#main-content');
    expect(first?.textContent).toBe('Skip to main content');
    const main = screen.getByRole('main');
    expect(main.id).toBe('main-content');
    expect(main.getAttribute('tabindex')).toBe('-1');
  });

  it('shows an accessible loading state while the session is unknown on an account page', () => {
    auth.isLoading = true;
    auth.authenticated = false;
    navigation.pathname = '/library';
    renderShell();
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.textContent).toContain('Loading MUSE');
    expect(screen.queryByRole('main')).toBeNull();
  });

  it('sends signed out visitors to the login page and remembers where they were', () => {
    auth.authenticated = false;
    navigation.pathname = '/settings';
    renderShell();
    expect(navigation.replace).toHaveBeenCalledWith('/login?next=%2Fsettings');
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('lets guests use the chat without a redirect and without waiting for the session', () => {
    auth.authenticated = false;
    auth.isLoading = true;
    navigation.pathname = '/chat';
    renderShell();
    expect(screen.getByRole('main')).toBeDefined();
    expect(screen.getByText('Page body')).toBeDefined();
    auth.isLoading = false;
    renderShell();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
