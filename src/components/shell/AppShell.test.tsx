import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NowPlayingProvider } from '@/hooks/use-now-playing';
import { TrackDetailsProvider } from '@/components/chat/TrackDetails';
import { TrackRow } from '@/components/chat/TrackRow';
import { RecommendationList } from '@/components/chat/RecommendationList';
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
      <TrackDetailsProvider>
        <NowPlayingProvider>
          <AppShell>{children}</AppShell>
        </NowPlayingProvider>
      </TrackDetailsProvider>
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
    vi.unstubAllGlobals();
  });

  it('lays out the sidebar and fixed phone tabs with room reserved below the page', () => {
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

    // Both navigations exist: the sidebar at md and up, the tabs below it.
    const navs = screen.getAllByRole('navigation', {
      name: 'Primary navigation',
    });
    expect(navs).toHaveLength(2);
    const fixed = Array.from(
      container.querySelectorAll('[class*="fixed"]'),
    ).filter((element) => !element.className.includes('sr-only'));
    expect(fixed).toEqual([screen.getByTestId('bottom-tabs')]);
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

  it('shows an accessible loading state while the session is unknown on a hidden page', () => {
    auth.isLoading = true;
    auth.authenticated = false;
    navigation.pathname = '/library';
    renderShell();
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.textContent).toContain('Loading MUSE');
    expect(screen.queryByRole('main')).toBeNull();
  });

  it('sends a visitor without a Spotify connection from a hidden page to Chat', () => {
    auth.authenticated = false;
    navigation.pathname = '/settings';
    renderShell();
    expect(navigation.replace).toHaveBeenCalledWith('/chat');
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('never paints a hidden page for a visitor without a Spotify connection', () => {
    auth.authenticated = false;
    auth.isLoading = false;
    navigation.pathname = '/library';
    renderShell(<p>Library body</p>);
    // The page body and its error states are not rendered at all: the shell
    // shows the loading state while the redirect is in flight, so a guest
    // sees Chat rather than a failure.
    expect(screen.queryByText('Library body')).toBeNull();
    expect(screen.getByRole('status')).toBeDefined();
    expect(navigation.replace).toHaveBeenCalledWith('/chat');
  });

  it('opens Profile to a visitor without a Spotify connection', () => {
    auth.authenticated = false;
    auth.isLoading = false;
    navigation.pathname = '/profile';
    renderShell(<p>Profile body</p>);
    expect(screen.getByText('Profile body')).toBeDefined();
    expect(navigation.replace).not.toHaveBeenCalled();
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

describe('compact tester track inspection', () => {
  beforeEach(() => {
    auth.authenticated = true;
    auth.isLoading = false;
    navigation.pathname = '/chat';
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(max-width: 1279px)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 401 }),
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it('opens the desktop content in a sheet, preserves the strip on close and reopens it', () => {
    renderShell(
      <TrackRow
        track={{
          id: '3n3Ppam7vgaVa1iaRUc9Lp',
          name: 'Night song',
          artists: 'Ada',
          reason: 'A calm groove.',
        }}
        index={0}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Select Night song' });
    fireEvent.click(trigger);
    const sheet = screen.getByRole('dialog', { name: 'Track details' });
    expect(within(sheet).getByText('A calm groove.')).toBeInTheDocument();
    fireEvent.click(
      within(sheet).getByRole('button', { name: 'Close track details' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    const strip = within(screen.getByTestId('now-playing-strip'));
    fireEvent.click(
      strip.getByRole('button', { name: 'Show details for Night song' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Track details' }),
    ).toBeInTheDocument();
  });
  it('also makes catalogue recommendation details available to testers without reopening a stale player sheet', () => {
    renderShell(
      <>
        <TrackRow
          track={{ id: 'one', name: 'Old selection', artists: 'Ada' }}
          index={0}
        />
        <RecommendationList
          title="New mix"
          tracks={[
            {
              id: 'two',
              title: 'New selection',
              artist: 'Tems',
              why: 'A mellow fit.',
              region: 'Nigeria',
            },
          ]}
        />
      </>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Select Old selection' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Close track details' }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Show details for New selection by Tems',
      }),
    );
    expect(
      within(screen.getByRole('dialog')).getByText('Why this: A mellow fit.'),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Close track details' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
