import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Wiring checks for /login: the server reads the environment and the session,
 * decides between the login screen and a redirect, and passes only validated
 * values down to the screen.
 */

const mocks = vi.hoisted(() => ({
  session: null as null | { userId: string },
  sessionError: null as null | Error,
  redirect: vi.fn((location: string) => {
    throw new Error(`NEXT_REDIRECT:${location}`);
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/lib/session', () => ({
  getSession: async () => {
    if (mocks.sessionError) throw mocks.sessionError;
    return mocks.session;
  },
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: null,
    authenticated: false,
    isLoading: false,
    logout: async () => {},
  }),
}));

vi.mock('motion/react', async () => {
  const { motionMock } = await import('@/test/motion-mock');
  return motionMock;
});

import LoginPage from './page';

const originalEnv = { ...process.env };

function configureSpotify() {
  process.env.SPOTIFY_CLIENT_ID = 'id';
  process.env.SPOTIFY_CLIENT_SECRET = 'secret';
  process.env.SPOTIFY_REDIRECT_URI =
    'http://127.0.0.1:3000/api/auth/spotify/callback';
  process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';
}

describe('/login', () => {
  beforeEach(() => {
    mocks.session = null;
    mocks.sessionError = null;
    mocks.redirect.mockClear();
    configureSpotify();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('renders the connection for a signed out visitor when sign-in is configured', async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Connect your Spotify.',
    );
    expect(
      screen
        .getByRole('link', { name: 'Continue with Spotify' })
        .getAttribute('href'),
    ).toBe('/api/auth/spotify');
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('shows the honest unavailable state when credentials are missing', async () => {
    delete process.env.SPOTIFY_CLIENT_SECRET;
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    const button = screen.getByRole('button', {
      name: 'Spotify connection unavailable',
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.queryByRole('link', { name: 'Continue with Spotify' }),
    ).toBeNull();
  });

  it('passes a validated return path through and drops unsafe ones', async () => {
    render(
      await LoginPage({ searchParams: Promise.resolve({ next: '/settings' }) }),
    );
    expect(
      screen
        .getByRole('link', { name: 'Continue with Spotify' })
        .getAttribute('href'),
    ).toBe('/api/auth/spotify?next=%2Fsettings');
  });

  it('ignores a return path that would leave the app', async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ next: 'https://evil.example' }),
      }),
    );
    expect(
      screen
        .getByRole('link', { name: 'Continue with Spotify' })
        .getAttribute('href'),
    ).toBe('/api/auth/spotify');
  });

  it('explains a sign-in that could not finish', async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ error: 'state_mismatch' }),
      }),
    );
    const notice = document.querySelector(
      '[data-auth-notice="state_mismatch"]',
    );
    expect(notice?.textContent).toContain(
      'That sign-in did not match this browser.',
    );
  });

  it('sends a signed in visitor straight on to where they were going', async () => {
    mocks.session = { userId: 'user-1' };
    await expect(
      LoginPage({ searchParams: Promise.resolve({ next: '/library' }) }),
    ).rejects.toThrow('NEXT_REDIRECT:/library');
    expect(mocks.redirect).toHaveBeenCalledWith('/library');
  });

  it('defaults a signed in visitor to /chat', async () => {
    mocks.session = { userId: 'user-1' };
    await expect(
      LoginPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('NEXT_REDIRECT:/chat');
  });

  it('still renders when the session lookup fails, and logs the failure', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mocks.sessionError = new Error('database unavailable');
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(consoleError).toHaveBeenCalled();
  });
});
