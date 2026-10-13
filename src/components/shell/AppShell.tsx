'use client';

import * as React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useRouter, usePathname } from 'next/navigation';
import { EqualizerBars } from '@/components/motion/EqualizerBars';
import { pageTransition, pageTransitionReduced } from '@/lib/motion';
import { useAuth } from '@/hooks/use-auth';
import { GUEST_HOME_PATH, isOpenAppPath } from './shell-nav';
import { Sidebar } from './Sidebar';
import { VibeBackdrop } from '@/components/motion/VibeBackdrop';
import { TopBar } from './TopBar';
import { BottomTabs } from './BottomTabs';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useNowPlaying } from '@/hooks/use-now-playing';
import { useChatViewport } from '@/hooks/use-chat-viewport';
import {
  TrackDetailsPanel,
  useTrackDetails,
} from '@/components/chat/TrackDetails';
import { NowPlaying } from './NowPlaying';
import { NowPlayingStrip } from './NowPlayingStrip';
import { BackToTop } from '@/components/ui/BackToTop';

/**
 * The app shell.
 *
 * One row that fills the visible viewport: the sidebar (md and up), the page
 * column, and the now-playing rail (xl and up). A single measured bottom
 * space reserves the compact strip and fixed phone tabs in the page column.
 * Touch chat focus hides that chrome and follows the visual viewport.
 *
 * Pages cross fade on route change with the shared page transition, and focus
 * moves to the main landmark so keyboard and screen reader users land on the
 * new page rather than on a tab they already pressed.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { authenticated, isLoading } = useAuth();
  const { selection } = useTrackDetails();
  const { detailsOpen, closeDetails, selectedTrack, activeTrack } =
    useNowPlaying();
  const compact = useMediaQuery('(max-width: 1279px)');
  useChatViewport();
  React.useEffect(() => {
    if (selection) closeDetails();
  }, [selection, closeDetails]);
  const router = useRouter();
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion() ?? false;
  const previousPathname = React.useRef(pathname);
  // The scrolling page column, so the floating back to top control can watch
  // it and send it back up. Pages that scroll their own region (chat) simply
  // never move this one, and their own control takes over there.
  const pageScrollRef = React.useRef<HTMLDivElement | null>(null);

  const shellRef = React.useRef<HTMLDivElement>(null);
  const stripRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const strip = stripRef.current;
    const shell = shellRef.current;
    if (!shell) return;
    const update = () =>
      shell.style.setProperty(
        '--muse-mini-player-space',
        `${strip?.getBoundingClientRect().height ?? 0}px`,
      );
    update();
    if (!strip || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [authenticated, isLoading, selectedTrack, activeTrack]);

  // Chat and Profile are open to everyone. A visitor without a Spotify
  // connection on any other page is sent to Chat: the hidden pages are not
  // part of the public product, and landing on one is a typing accident or a
  // stale link, not an error worth showing. replace() keeps the hidden route
  // out of the history so Back does not bounce them into it again.
  const openPath = isOpenAppPath(pathname);
  const redirecting = !isLoading && !authenticated && !openPath;
  React.useEffect(() => {
    if (redirecting) router.replace(GUEST_HOME_PATH);
  }, [redirecting, router]);

  React.useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    closeDetails();
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('main-content')?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, closeDetails]);

  // Open pages paint straight away; the session only changes what the
  // sidebar offers, and waiting for it would cost a round trip on every visit.
  // While the session is unknown, and while a hidden page waits for the
  // redirect, the page body is not rendered at all, so a guest never sees the
  // hidden page or one of its error states.
  if ((isLoading && !openPath) || redirecting) {
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
    <div
      ref={shellRef}
      className="muse-shell flex overflow-hidden bg-background text-text-primary"
    >
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-50 rounded-md bg-surface px-4 py-3 text-sm font-semibold text-text-primary focus:not-sr-only"
      >
        Skip to main content
      </a>

      <Sidebar />

      <div className="muse-page-column relative flex min-w-0 flex-1 flex-col">
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

        {authenticated ? (
          <div
            ref={stripRef}
            className="muse-mini-player absolute inset-x-0 bottom-[var(--muse-tabs-space)] xl:hidden"
          >
            <NowPlayingStrip />
          </div>
        ) : null}
        <BottomTabs />
      </div>

      {authenticated && !selection ? <NowPlaying /> : <TrackDetailsPanel />}
      <BottomSheet
        open={
          authenticated &&
          !selection &&
          !!(selectedTrack || activeTrack) &&
          detailsOpen &&
          compact
        }
        onClose={closeDetails}
        title="Track details"
      >
        <NowPlaying embedded />
      </BottomSheet>
    </div>
  );
}
