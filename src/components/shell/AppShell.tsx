'use client';

import * as React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Sidebar } from './Sidebar';
import { NowPlaying } from './NowPlaying';
import { MobileNav } from './MobileNav';
import { transitions } from '@/lib/motion';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { authenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion() ?? false;

  React.useEffect(() => {
    if (!isLoading && !authenticated && pathname !== '/') {
      router.push('/');
    }
  }, [authenticated, isLoading, pathname, router]);

  if (isLoading && pathname !== '/') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">Loading MUSE</span>
          <div className="flex h-4 items-end gap-1" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                style={{ transformOrigin: 'bottom' }}
                animate={
                  shouldReduceMotion ? { scaleY: 1 } : { scaleY: [0.35, 1, 0.35] }
                }
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { repeat: Infinity, duration: 0.8, delay: index * 0.1 }
                }
                className="h-3.5 w-1 rounded-full bg-accent"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-50 rounded-md bg-surface px-4 py-3 text-sm font-semibold text-text-primary focus:not-sr-only"
      >
        Skip to main content
      </a>
      <Sidebar />
      <MobileNav />

      <main
        id="main-content"
        tabIndex={-1}
        className="relative flex min-w-0 flex-1 flex-col pt-16 pb-16 lg:pt-0 lg:pb-0"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -12 }}
            transition={
              shouldReduceMotion ? { duration: 0 } : transitions.standard
            }
            className="flex-1 overflow-y-auto"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <NowPlaying />
    </div>
  );
}
