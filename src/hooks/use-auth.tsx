'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

interface User {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

interface AuthResponse {
  authenticated: boolean;
  user?: User;
}

const AuthContext = React.createContext<{
  user: User | null;
  authenticated: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
}>({
  user: null,
  authenticated: false,
  isLoading: true,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading, refetch } = useQuery<AuthResponse>({
    queryKey: ['auth'],
    queryFn: async () => {
      const res = await fetch('/api/me');
      if (!res.ok) throw new Error('Failed to fetch auth state');
      return res.json();
    },
  });

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    await refetch();
    window.location.href = '/';
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
