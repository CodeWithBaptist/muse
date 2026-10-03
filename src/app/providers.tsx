'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useState } from 'react';
import { AuthProvider } from '@/hooks/use-auth';
import { NowPlayingProvider } from '@/hooks/use-now-playing';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <NowPlayingProvider>{children}</NowPlayingProvider>
        </AuthProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
