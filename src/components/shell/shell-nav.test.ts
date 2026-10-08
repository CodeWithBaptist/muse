import { describe, expect, it } from 'vitest';
import {
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

  it('opens only the chat to guests and keeps the rest behind an account', () => {
    expect(navItemsFor(false).map((item) => item.href)).toEqual(['/chat']);
    expect(navItemsFor(true)).toBe(PRIMARY_NAV);
    expect(isOpenAppPath('/chat')).toBe(true);
    expect(isOpenAppPath('/chat/anything')).toBe(true);
    expect(isOpenAppPath('/')).toBe(true);
    expect(isOpenAppPath('/library')).toBe(false);
    expect(isOpenAppPath('/settings')).toBe(false);
    expect(isOpenAppPath(null)).toBe(false);
  });
});
