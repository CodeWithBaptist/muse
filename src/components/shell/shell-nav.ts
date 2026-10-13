import type { LucideIcon } from 'lucide-react';
import {
  Compass,
  Library,
  MessageSquare,
  Music2,
  Settings,
  User,
} from 'lucide-react';

/**
 * The one list of app destinations, shared by the sidebar and the bottom tabs
 * so the two can never disagree about what the app contains.
 *
 * "Chat" is labelled as the place, not as an action: the chat page owns its
 * own "New chat" control, and a link to a route you are already on starts
 * nothing.
 */
export interface ShellNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Open to everyone; the rest need a tester account and its Spotify data. */
  open?: boolean;
}

export const PRIMARY_NAV: readonly ShellNavItem[] = [
  { label: 'Chat', href: '/chat', icon: MessageSquare, open: true },
  { label: 'Discover', href: '/discover', icon: Compass },
  { label: 'Library', href: '/library', icon: Library },
  { label: 'Playlists', href: '/playlists', icon: Music2 },
  { label: 'Profile', href: '/profile', icon: User, open: true },
];

/** Where a visitor without a Spotify connection is sent from a hidden page. */
export const GUEST_HOME_PATH = '/chat';

/** Open routes that are not in the navigation. */
export const OPEN_PATHS: readonly string[] = ['/plus'];

/**
 * The destinations a visitor sees: everything for a connected tester (the
 * only accounts MUSE has), Chat and Profile for everyone else. Discover,
 * Library, and Playlists need a Spotify connection to mean anything, so a
 * guest never sees them.
 */
export function navItemsFor(authenticated: boolean): readonly ShellNavItem[] {
  return authenticated ? PRIMARY_NAV : PRIMARY_NAV.filter((item) => item.open);
}

/** The three destinations a visitor without a Spotify connection never sees. */
export const GUEST_HIDDEN_LABELS = PRIMARY_NAV.filter((item) => !item.open).map(
  (item) => item.label,
);

/**
 * True for routes that work without a Spotify connection. The shell sends a
 * visitor off anything else to GUEST_HOME_PATH, so no hidden page ever paints
 * for them and no error state is reachable.
 */
export function isOpenAppPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === '/') return true;
  if (OPEN_PATHS.some((path) => isActivePath(pathname, path))) return true;
  return PRIMARY_NAV.some(
    (item) => item.open && isActivePath(pathname, item.href),
  );
}

export const SETTINGS_NAV: ShellNavItem = {
  label: 'Settings',
  href: '/settings',
  icon: Settings,
};

/**
 * A destination is active for its own path and for anything nested under it,
 * so /playlists/abc still highlights Playlists. The root is never a prefix.
 */
export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}
