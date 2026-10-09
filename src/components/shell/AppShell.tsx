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
import { VibeBackdrop } from '@/components/motion/VibeBackdrop';
import { TopBar } from './TopBar';
import { BottomTabs } from './BottomTabs';
import { NowPlaying } from './NowPlaying';
import { NowPlayingStrip } from './NowPlayingStrip';
import { BackToTop } from '@/components/ui/BackToTop';

/**
 * The app shell.
 *
 * One row that fills the visible viewport: the sidebar (md and up), the page
 * column, and the now-playing rail (xl and up). The page column stacks the
 * phone header, the scrolling page, and the compact now-playing strip (below
 * xl). The fixed bottom tabs (below md) reserve space in the shell and follow
 * the safe area and visible viewport when the on-screen keyboard opens.
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
  // The scrolling page column, so the floating back to top control can watch
  // it and send it back up. Pages that scroll their own region (chat) simply
  // never move this one, and their own control takes over there.
  const pageScrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    const clearViewportState = () => {
      root.removeAttribute('data-keyboard-visible');
      root.style.removeProperty('--muse-visual-viewport-top');
      root.style.removeProperty('--muse-visual-viewport-height');
      root.style.removeProperty('--muse-visual-viewport-bottom-offset');
    };
    const updateViewportState = () => {
      const isMobile = window.matchMedia('(max-width: 767px)').matches;
      const bottomOffset = Math.max(
        0,
        window.innerHeight - viewport.offsetTop - viewport.height,
      );
      const keyboardVisible =
        isMobile && viewport.scale === 1 && bottomOffset > 120;

      if (!keyboardVisible) {
        clearViewportState();
        return;
      }

      root.setAttribute('data-keyboard-visible', 'true');
      root.style.setProperty(
        '--muse-visual-viewport-top',
        `${Math.max(0, viewport.offsetTop)}px`,
      );
      root.style.setProperty(
        '--muse-visual-viewport-height',
        `${viewport.height}px`,
      );
      root.style.setProperty(
        '--muse-visual-viewport-bottom-offset',
        `${bottomOffset}px`,
      );
    };

    viewport.addEventListener('resize', updateViewportState);
    viewport.addEventListener('scroll', updateViewportState);
    window.addEventListener('resize', updateViewportState);
    updateViewportState();

    return () => {
      viewport.removeEventListener('resize', updateViewportState);
      viewport.removeEventListener('scroll', updateViewportState);
      window.removeEventListener('resize', updateViewportState);
      clearViewportState();
    };
  }, []);

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
          <VibeBackdrop />
          <AnimatePresence mode="wait">
            <motion.div
              ref={pageScrollRef}
              key={pathname}
              initial={transition.initial}
              animate={transition.animate}
              exit={transition.exit}
              transition={transition.transition}
              className="relative z-[1] min-h-0 flex-1 overflow-y-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
          {/* Absolute inside main, so the control floats over the page but
              never over the top bar, the now playing strip, or the bottom
              tabs, whatever the screen size. */}
          <BackToTop
            scrollerRef={pageScrollRef}
            className="absolute bottom-5 right-4 z-30 sm:right-6"
          />
        </main>

        <NowPlayingStrip />
        <BottomTabs />
      </div>

      <NowPlaying />
    </div>
  );
}
