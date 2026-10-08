import * as React from 'react';
import { act, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth, type LogoutResult } from './use-auth';

/**
 * Log out must end the session on the server before it leaves the app. These
 * tests drive the hook directly and check that failures come back as results
 * rather than being hidden behind a redirect.
 */

function Harness({
  onReady,
}: {
  onReady: (logout: () => Promise<LogoutResult>) => void;
}) {
  const { logout } = useAuth();
  React.useEffect(() => {
    onReady(logout);
  }, [logout, onReady]);
  return null;
}

function mountHook() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let logout: (() => Promise<LogoutResult>) | null = null;
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Harness
          onReady={(fn) => {
            logout = fn;
          }}
        />
      </AuthProvider>
    </QueryClientProvider>,
  );
  if (!logout) throw new Error('logout was not provided');
  return logout as () => Promise<LogoutResult>;
}

describe('useAuth logout', () => {
  const originalFetch = globalThis.fetch;
  const assign = vi.fn();

  beforeEach(() => {
    assign.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign },
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function stubFetch(logoutResponse: () => Promise<Response>) {
    globalThis.fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === '/api/auth/logout' && init?.method === 'POST')
          return logoutResponse();
        return new Response(
          JSON.stringify({ authenticated: true, user: null }),
          {
            headers: { 'Content-Type': 'application/json' },
          },
        );
      },
    ) as typeof fetch;
  }

  it('leaves for the landing page only after the server confirms', async () => {
    stubFetch(async () => Response.json({ success: true }));
    const logout = mountHook();

    let result: LogoutResult | undefined;
    await act(async () => {
      result = await logout();
    });

    expect(result).toEqual({ ok: true });
    expect(assign).toHaveBeenCalledWith('/');
  });

  it('reports the server message when the session could not be ended', async () => {
    stubFetch(async () =>
      Response.json({ error: 'Unable to log out right now.' }, { status: 500 }),
    );
    const logout = mountHook();

    let result: LogoutResult | undefined;
    await act(async () => {
      result = await logout();
    });

    expect(result).toEqual({
      ok: false,
      message: 'Unable to log out right now.',
    });
    expect(assign).not.toHaveBeenCalled();
  });

  it('reports a network failure without leaving the app', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    const logout = mountHook();

    let result: LogoutResult | undefined;
    await act(async () => {
      result = await logout();
    });

    expect(result?.ok).toBe(false);
    if (!result || result.ok) throw new Error('expected a failure');
    expect(result.message).toContain('Could not reach MUSE');
    expect(assign).not.toHaveBeenCalled();
  });
});
