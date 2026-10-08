'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

interface User {
  id?: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

interface AuthResponse {
  authenticated: boolean;
  user?: User;
}

/**
 * Outcome of a log out attempt. Callers show the message when it fails; on
 * success the browser is already on its way to the landing page.
 */
export type LogoutResult = { ok: true } | { ok: false; message: string };

const LOGOUT_UNREACHABLE_MESSAGE =
  'Could not reach MUSE to log you out. Check your connection and try again.';
const LOGOUT_FAILED_MESSAGE = 'Unable to log out right now. Please try again.';

const AuthContext = React.createContext<{
  user: User | null;
  authenticated: boolean;
  isLoading: boolean;
  logout: () => Promise<LogoutResult>;
}>({
  user: null,
  authenticated: false,
  isLoading: true,
  logout: async () => ({ ok: false, message: LOGOUT_FAILED_MESSAGE }),
});

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string' && body.error.trim()) return body.error;
  } catch {
    // Not JSON; fall through to the generic message.
  }
  return LOGOUT_FAILED_MESSAGE;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useQuery<AuthResponse>({
    queryKey: ['auth'],
    queryFn: async () => {
      const res = await fetch('/api/me');
      if (!res.ok) throw new Error('Failed to fetch auth state');
      return res.json();
    },
  });

  /**
   * Ends the session on the server first and only then leaves the app. A
   * failed request is reported back, never papered over with a redirect that
   * would look like a successful log out while the session still exists.
   */
  const logout = async (): Promise<LogoutResult> => {
    let response: Response;
    try {
      response = await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      return { ok: false, message: LOGOUT_UNREACHABLE_MESSAGE };
    }
    if (!response.ok) {
      return { ok: false, message: await readErrorMessage(response) };
    }
    // A full navigation drops every cached query along with the session.
    window.location.assign('/');
    return { ok: true };
  };

  return (
    <AuthContext.Provider
      value={{
        user: data?.user || null,
        authenticated: !!data?.authenticated,
        isLoading,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => React.useContext(AuthContext);
