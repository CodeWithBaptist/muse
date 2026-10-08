'use client';

import * as React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useRouter, usePathname } from 'next/navigation';
import { EqualizerBars } from '@/components/motion/EqualizerBars';
import { pageTransition, pageTransitionReduced } from '@/lib/motion';
import { useAuth } from '@/hooks/use-auth';
import { loginPathForReturn } from '@/lib/auth-flow';
import { isOpenAppPath } from './shell-nav';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomTabs } from './BottomTabs';
import { NowPlaying } from './NowPlaying';
import { NowPlayingStrip } from './NowPlayingStrip';

/**
 * The app shell.
 *
 * One row that fills the visible viewport: the sidebar (lg and up), the page
 * column, and the now-playing rail (xl and up). The page column stacks the
 * phone header, the scrolling page, the compact now-playing strip (below xl),
 * and the bottom tabs (below lg). Every bar is in normal flow, so nothing is
 * fixed over the content and safe areas are handled where the bars touch the
 * edges.
 *
 * Pages cross fade on route change with the shared page transition, and focus
 * moves to the main landmark so keyboard and screen reader users land on the
 * new page rather than on a tab they already pressed.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { authenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion() ?? false;
  const previousPathname = React.useRef(pathname);

  // Chat is open to everyone. Signed out visitors on the account-only pages
  // go to the login page, which brings them back once connected. replace()
  // keeps the protected page out of the history so Back does not bounce them
  // into the redirect again.
  const openPath = isOpenAppPath(pathname);
  React.useEffect(() => {
    if (!isLoading && !authenticated && !openPath) {
      router.replace(loginPathForReturn(pathname));
    }
  }, [authenticated, isLoading, openPath, pathname, router]);

  React.useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('main-content')?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  // Open pages paint straight away; the session only changes what the
  // sidebar offers, and waiting for it would cost a round trip on every visit.
  if (isLoading && !openPath) {
    return (
      <div className="muse-shell flex items-center justify-center bg-background">
        <div role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">Loading MUSE</span>
          <EqualizerBars bars={3} height={16} width={4} />
        </div>
      </div>
    );
  }

  const transition = shouldReduceMotion
    ? pageTransitionReduced
    : pageTransition;

  return (
    <div className="muse-shell flex overflow-hidden bg-background text-text-primary">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-50 rounded-md bg-surface px-4 py-3 text-sm font-semibold text-text-primary focus:not-sr-only"
      >
        Skip to main content
      </a>

      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />

        <main
          id="main-content"
          tabIndex={-1}
          className="relative flex min-h-0 flex-1 flex-col outline-none"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={transition.initial}
              animate={transition.animate}
              exit={transition.exit}
              transition={transition.transition}
              className="min-h-0 flex-1 overflow-y-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <NowPlayingStrip />
        <BottomTabs />
      </div>

      <NowPlaying />
    </div>
  );
}
