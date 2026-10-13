import { describe, expect, it } from 'vitest';
import {
  GUEST_HIDDEN_LABELS,
  GUEST_HOME_PATH,
  PRIMARY_NAV,
  SETTINGS_NAV,
  isActivePath,
  isOpenAppPath,
  navItemsFor,
} from './shell-nav';

describe('shell navigation', () => {
  it('lists the five app destinations in thumb order, with settings kept apart', () => {
    expect(PRIMARY_NAV.map((item) => item.label)).toEqual([
      'Chat',
      'Discover',
      'Library',
      'Playlists',
      'Profile',
    ]);
    expect(PRIMARY_NAV.map((item) => item.href)).toEqual([
      '/chat',
      '/discover',
      '/library',
      '/playlists',
      '/profile',
    ]);
    expect(SETTINGS_NAV.href).toBe('/settings');
    expect(PRIMARY_NAV.some((item) => item.href === SETTINGS_NAV.href)).toBe(
      false,
    );
  });

  it('matches a destination for its own path and nested paths only', () => {
    expect(isActivePath('/chat', '/chat')).toBe(true);
    expect(isActivePath('/playlists/abc123', '/playlists')).toBe(true);
    expect(isActivePath('/playlists-archive', '/playlists')).toBe(false);
    expect(isActivePath('/discover', '/chat')).toBe(false);
    expect(isActivePath('/', '/chat')).toBe(false);
    expect(isActivePath(null, '/chat')).toBe(false);
  });

  it('gives a visitor without a Spotify connection Chat and Profile only', () => {
    expect(navItemsFor(false).map((item) => item.href)).toEqual([
      '/chat',
      '/profile',
    ]);
    expect(navItemsFor(false).map((item) => item.label)).toEqual([
      'Chat',
      'Profile',
    ]);
    // The three hidden destinations are Discover, Library, and Playlists.
    expect(GUEST_HIDDEN_LABELS).toEqual(['Discover', 'Library', 'Playlists']);
  });

  it('keeps every destination for a tester with a Spotify connection', () => {
    expect(navItemsFor(true)).toBe(PRIMARY_NAV);
    expect(navItemsFor(true).map((item) => item.href)).toEqual([
      '/chat',
      '/discover',
      '/library',
      '/playlists',
      '/profile',
    ]);
  });

  it('names the open routes and the one destination a guest is sent to', () => {
    expect(GUEST_HOME_PATH).toBe('/chat');
    expect(isOpenAppPath('/profile')).toBe(true);
    expect(isOpenAppPath('/chat')).toBe(true);
    expect(isOpenAppPath('/chat/anything')).toBe(true);
    expect(isOpenAppPath('/')).toBe(true);
    expect(isOpenAppPath('/plus')).toBe(true);
    // Anything else is hidden and gets the redirect in AppShell.
    expect(isOpenAppPath('/library')).toBe(false);
    expect(isOpenAppPath('/discover')).toBe(false);
    expect(isOpenAppPath('/playlists')).toBe(false);
    expect(isOpenAppPath('/playlists/abc123')).toBe(false);
    expect(isOpenAppPath('/settings')).toBe(false);
    expect(isOpenAppPath(null)).toBe(false);
  });
});
