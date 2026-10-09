import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginScreen, SPOTIFY_ACCESS_ITEMS } from './LoginScreen';
import { AUTH_NOTICES } from './AuthNotice';
import { spotifyConnectHref } from './SpotifyConnectLink';

const auth = vi.hoisted(() => ({ authenticated: false }));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: auth.authenticated
      ? { displayName: 'Ada', email: 'ada@example.com' }
      : null,
    authenticated: auth.authenticated,
    isLoading: false,
    logout: async () => {},
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

vi.mock('motion/react', async () => {
  const { motionMock } = await import('@/test/motion-mock');
  return motionMock;
});

describe('LoginScreen', () => {
  beforeEach(() => {
    auth.authenticated = false;
  });

  it('is a real link to the auth route when sign-in is configured', () => {
    render(<LoginScreen spotifyLoginAvailable />);
    const link = screen.getByRole('link', { name: 'Continue with Spotify' });
    expect(link.getAttribute('href')).toBe('/api/auth/spotify');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('carries the return path into the auth route', () => {
    render(<LoginScreen spotifyLoginAvailable next="/settings" />);
    const link = screen.getByRole('link', { name: 'Continue with Spotify' });
    expect(link.getAttribute('href')).toBe(
      '/api/auth/spotify?next=%2Fsettings',
    );
    expect(spotifyConnectHref('/chat')).toBe('/api/auth/spotify');
    expect(spotifyConnectHref(null)).toBe('/api/auth/spotify');
  });

  it('shows a disabled, explained action when sign-in is not configured', () => {
    render(<LoginScreen spotifyLoginAvailable={false} />);
    expect(
      screen.queryByRole('link', { name: 'Continue with Spotify' }),
    ).toBeNull();
    const button = screen.getByRole('button', {
      name: 'Spotify connection unavailable',
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    const note = document.getElementById(
      button.getAttribute('aria-describedby') as string,
    );
    expect(note?.textContent).toContain(
      'not configured for this deployment yet',
    );
    expect(note?.hasAttribute('data-spotify-login-note')).toBe(true);
  });

  it('explains a failed sign-in above the action', () => {
    render(<LoginScreen spotifyLoginAvailable authError="access_denied" />);
    const notice = document.querySelector('[data-auth-notice]');
    expect(notice?.getAttribute('data-auth-notice')).toBe('access_denied');
    expect(notice?.textContent).toContain(AUTH_NOTICES.access_denied.title);
    expect(
      screen.getByRole('link', { name: 'Continue with Spotify' }),
    ).toBeTruthy();
  });

  it('offers the way into the app to someone who is already signed in', () => {
    auth.authenticated = true;
    render(<LoginScreen spotifyLoginAvailable next="/library" />);
    expect(
      screen.queryByRole('link', { name: 'Continue with Spotify' }),
    ).toBeNull();
    const link = screen.getByRole('link', { name: 'Continue to MUSE' });
    expect(link.getAttribute('href')).toBe('/library');
  });

  it('lists what will be asked for and where to read more', () => {
    render(<LoginScreen spotifyLoginAvailable />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Connect your Spotify.',
    );
    const list = screen.getByRole('list');
    expect(list.querySelectorAll('li')).toHaveLength(
      SPOTIFY_ACCESS_ITEMS.length,
    );
    expect(list.textContent).toContain(
      'Spotify only allows this on Premium accounts.',
    );
    expect(screen.getByText(/never sees your Spotify password/)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Privacy' }).getAttribute('href'),
    ).toBe('/privacy');
    expect(
      screen.getByRole('link', { name: 'Terms' }).getAttribute('href'),
    ).toBe('/terms');
    expect(
      screen.getByRole('link', { name: 'MUSE home' }).getAttribute('href'),
    ).toBe('/');
    expect(screen.getByRole('main').id).toBe('main-content');
  });

  it('describes only permissions the auth route actually requests', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(`${process.cwd()}/src/lib/spotify.ts`, 'utf8');
    const expectations: Array<[string, string[]]> = [
      [
        'What you listen to',
        ['user-top-read', 'user-read-recently-played', 'user-library-read'],
      ],
      [
        'Playlists you ask for',
        ['playlist-modify-public', 'playlist-modify-private'],
      ],
      [
        'Playback on your devices',
        ['user-read-playback-state', 'user-modify-playback-state'],
      ],
      ['Your name and email', ['user-read-private', 'user-read-email']],
    ];
    for (const [title, scopes] of expectations) {
      expect(
        SPOTIFY_ACCESS_ITEMS.some((item) => item.title === title),
        title,
      ).toBe(true);
      for (const scope of scopes) expect(source, scope).toContain(`'${scope}'`);
    }
  });
});

describe('LoginScreen tester access', () => {
  it('asks for a tester key and offers the no-account way in when a key is required', () => {
    render(<LoginScreen spotifyLoginAvailable={false} testerAccess="key" />);
    expect(screen.getByTestId('tester-key-form')).toBeDefined();
    expect(screen.getByLabelText('Tester key')).toBeDefined();
    expect(screen.queryByRole('link', { name: /Continue with Spotify|Connect/ })).toBeNull();
    expect(screen.queryByText('What MUSE will ask for')).toBeNull();
    expect(screen.getByRole('link', { name: 'Start' }).getAttribute('href')).toBe('/chat');
  });

  it('shows nothing to sign in to when no tester access is configured', () => {
    render(<LoginScreen spotifyLoginAvailable={false} testerAccess="hidden" />);
    expect(screen.getByTestId('tester-access-hidden')).toBeDefined();
    expect(screen.queryByTestId('tester-key-form')).toBeNull();
    expect(screen.queryByText('What MUSE will ask for')).toBeNull();
    expect(screen.getByRole('link', { name: 'Start' }).getAttribute('href')).toBe('/chat');
  });

  it('sends the key to the server and shows the server\u2019s answer when it is wrong', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'That tester key is not right.' }), { status: 403 }),
    );
    render(<LoginScreen spotifyLoginAvailable={false} testerAccess="key" />);
    fireEvent.change(screen.getByLabelText('Tester key'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('That tester key is not right.'));
    expect(fetchMock).toHaveBeenCalledWith('/api/tester', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({ key: 'nope' });
    fetchMock.mockRestore();
  });
});
