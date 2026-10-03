'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/hooks/use-auth';
import { useNowPlaying, getSpotifyTrackUrl } from '@/hooks/use-now-playing';
import { fadeIn, transitions } from '@/lib/motion';

const NAV_ITEMS = [
  { name: 'Chat', icon: PlusSquare, href: '/chat' },
  { name: 'Discover', icon: Compass, href: '/discover' },
  { name: 'Library', icon: Library, href: '/library' },
  { name: 'Playlists', icon: Music2, href: '/playlists' },
  { name: 'Profile', icon: User, href: '/profile' },
  { name: 'Settings', icon: Settings, href: '/settings' },
];

export function MobileNav() {
  const pathname = usePathname();
  const { authenticated, logout } = useAuth();
  const { selectedTrack } = useNowPlaying();
  const [openPathname, setOpenPathname] = React.useState<string | null>(null);
  const isOpen = openPathname === pathname;

  const artistName = selectedTrack
    ? Array.isArray(selectedTrack.artists)
      ? selectedTrack.artists.map((a) => a.name).join(', ')
      : selectedTrack.artists
    : '';
  const artUrl =
    selectedTrack?.album?.images?.[0]?.url || selectedTrack?.albumArtUrl;
  const spotifyUrl = getSpotifyTrackUrl(selectedTrack?.id);

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b border-border-subtle bg-background z-40 flex items-center justify-between px-6">
        <Link href="/" className="flex items-center">
          <Logo variant="wordmark" size={80} />
        </Link>
        <button
          type="button"
          aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() =>
            setOpenPathname((prev) => (prev === pathname ? null : pathname))
          }
          className="p-2 -mr-2 text-text-secondary hover:text-text-primary"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.standard}
            className="lg:hidden fixed inset-0 top-16 bottom-16 bg-background z-30 p-6 flex flex-col justify-between overflow-y-auto"
          >
            <nav className="space-y-4">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setOpenPathname(null)}
                  className={cn(
                    'flex items-center gap-4 text-xl font-medium transition-colors py-1',
                    pathname === item.href ? 'text-accent' : 'text-text-primary'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              ))}
            </nav>

            {authenticated && (
              <div className="pt-4 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => {
                    setOpenPathname(null);
                    logout();
                  }}
                  className="flex items-center gap-4 text-base font-medium text-text-secondary hover:text-text-primary transition-colors py-2"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Selected Track Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-border-subtle bg-background z-40 flex items-center justify-between px-6 gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 bg-surface rounded border border-border-strong flex items-center justify-center shrink-0 overflow-hidden">
            {artUrl ? (
              <img
                src={artUrl}
                alt={selectedTrack?.name || 'Track'}
                className="w-full h-full object-cover"
              />
            ) : (
              <Logo variant="mark" size={16} className="opacity-20" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {selectedTrack ? (
              <>
                <div className="text-xs font-semibold text-text-primary truncate">
                  {selectedTrack.name}
                </div>
                <div className="text-[11px] text-text-secondary truncate">
                  {artistName}
                </div>
              </>
            ) : (
              <div className="text-xs font-medium text-text-muted truncate">
                Select a track to inspect or open in Spotify
              </div>
            )}
          </div>
        </div>

        {selectedTrack && spotifyUrl && (
          <a
            href={spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent text-background text-xs font-semibold shrink-0"
          >
            <span>Spotify</span>
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </>
  );
}
