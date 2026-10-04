"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PlusSquare,
  Compass,
  Library,
  Music2,
  User,
  Settings,
  LogOut,
  ExternalLink,
  Menu,
  X,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/hooks/use-auth";
import { getSpotifyTrackUrl, useNowPlaying } from "@/hooks/use-now-playing";
import { fadeIn, transitions } from "@/lib/motion";
import { PlaybackButton } from "./PlaybackButton";
import { TrackArtwork } from "./TrackArtwork";

const NAV_ITEMS = [
  { name: "Chat", icon: PlusSquare, href: "/chat" },
  { name: "Discover", icon: Compass, href: "/discover" },
  { name: "Library", icon: Library, href: "/library" },
  { name: "Playlists", icon: Music2, href: "/playlists" },
  { name: "Profile", icon: User, href: "/profile" },
  { name: "Settings", icon: Settings, href: "/settings" },
];

function artistLabel(track: { artists: { name: string }[] | string }) {
  return Array.isArray(track.artists)
    ? track.artists.map((artist) => artist.name).join(", ")
    : track.artists;
}

export function MobileNav() {
  const pathname = usePathname();
  const { authenticated, logout } = useAuth();
  const {
    selectedTrack,
    activeTrack,
    availability,
    playbackPreference,
    isPlaying,
    isBuffering,
    playbackMode,
    playbackNotice,
    getPlaybackAction,
    playTrack,
    togglePlayback,
    isTrackPlaying,
    isTrackBuffering,
  } = useNowPlaying();
  const [openPathname, setOpenPathname] = React.useState<string | null>(null);
  const isOpen = openPathname === pathname;
  const shouldReduceMotion = useReducedMotion() ?? false;
  const menuButtonRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const previousPathname = React.useRef(pathname);

  React.useEffect(() => {
    if (!isOpen) return;

    menuRef.current?.querySelector<HTMLElement>('a[href]')?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpenPathname(null);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  React.useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    window.requestAnimationFrame(() => {
      document.getElementById('main-content')?.focus();
    });
  }, [pathname]);

  const track =
    isPlaying || isBuffering
      ? (activeTrack ?? selectedTrack)
      : (selectedTrack ?? activeTrack);
  const artistName = track ? artistLabel(track) : "";
  const artUrl = track?.album?.images?.[0]?.url || track?.albumArtUrl;
  const spotifyUrl = getSpotifyTrackUrl(track?.id);
  const action = track ? getPlaybackAction(track) : null;
  const playing = track ? isTrackPlaying(track.id) : false;
  const busy = track ? isTrackBuffering(track.id) : false;
  const isActiveTrack =
    track !== null && activeTrack?.id === track.id && playbackMode !== null;
  const actionLabel =
    track && action === "spotify" ? `Play ${track.name} on Spotify` : "";
  const inlineNotice =
    playbackNotice ??
    (playbackPreference === "spotify" && !isActiveTrack
      ? "Your playback preference is Spotify. Open this track there to listen."
      : availability === "ready" && !isActiveTrack
        ? "Open Spotify on an active device to play from MUSE."
        : availability === "premium-required"
          ? "Eligible Spotify Premium is required for playback here."
          : availability === "reconnect-required"
            ? "Reconnect Spotify for playback."
            : availability === "unavailable"
              ? "Playback unavailable. Open in Spotify."
              : availability === "disconnected"
                ? "Connect Spotify to play here."
                : null);

  const handlePlayback = () => {
    if (!track) return;
    if (isActiveTrack) {
      void togglePlayback();
    } else {
      void playTrack(track);
    }
  };

  return (
    <>
      <header
        role="banner"
        aria-label="Mobile header"
        className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-border-subtle bg-background px-6 lg:hidden"
      >
        <Link href="/" className="flex items-center">
          <Logo variant="wordmark" size={80} />
        </Link>
        <button
          ref={menuButtonRef}
          type="button"
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={isOpen}
          aria-controls={isOpen ? "mobile-site-navigation" : undefined}
          onClick={() =>
            setOpenPathname((previous) =>
              previous === pathname ? null : pathname,
            )
          }
          className="-mr-2 p-2 text-text-secondary hover:text-text-primary"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="mobile-site-navigation"
            ref={menuRef}
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={
              shouldReduceMotion ? { duration: 0 } : transitions.standard
            }
            className="fixed inset-x-0 bottom-16 top-16 z-30 flex flex-col justify-between overflow-y-auto bg-background p-6 lg:hidden"
          >
            <nav aria-label="Mobile navigation" className="space-y-4">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  onClick={() => setOpenPathname(null)}
                  className={cn(
                    "flex items-center gap-4 py-1 text-xl font-medium transition-colors",
                    pathname === item.href
                      ? "text-accent"
                      : "text-text-primary",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              ))}
            </nav>

            {authenticated && (
              <div className="border-t border-border-subtle pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setOpenPathname(null);
                    void logout();
                  }}
                  className="flex items-center gap-4 py-2 text-base font-medium text-text-secondary transition-colors hover:text-text-primary"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <aside
        aria-label="Mobile now playing controls"
        className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-between gap-3 border-t border-border-subtle bg-background px-4 lg:hidden sm:px-6"
      >
        <span className="sr-only" role="status" aria-live="polite">
          {inlineNotice ?? ""}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-border-strong bg-surface">
            {artUrl ? (
              <TrackArtwork
                src={artUrl}
                alt={track?.name ?? "Track artwork"}
                className="h-full w-full"
              />
            ) : (
              <Logo variant="mark" size={16} className="opacity-20" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {track ? (
              <>
                <div className="truncate text-xs font-semibold text-text-primary">
                  {track.name}
                </div>
                <div className="truncate text-[11px] text-text-secondary">
                  {artistName}
                </div>
                {inlineNotice && (
                  <div
                    title={inlineNotice}
                    className="truncate text-[10px] leading-tight text-text-muted"
                  >
                    {inlineNotice}
                  </div>
                )}
              </>
            ) : (
              <div className="truncate text-xs font-medium text-text-muted">
                Select a track to play on Spotify
              </div>
            )}
          </div>
        </div>

        {track && action && (
          <PlaybackButton
            playing={playing}
            busy={busy}
            label={
              busy
                ? "Starting playback"
                : playing
                  ? `Pause ${track.name} on Spotify`
                  : actionLabel
            }
            onClick={handlePlayback}
            className="h-9 w-9 shrink-0"
          />
        )}

        {track && spotifyUrl && (
          <a
            href={spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${track.name} in Spotify`}
            title="Open in Spotify"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
          >
            <ExternalLink size={16} />
          </a>
        )}
      </aside>
    </>
  );
}
