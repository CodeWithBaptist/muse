// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHAT_PREFERENCES_STORAGE_KEY,
  getChatPreferences,
  getServerChatPreferences,
  setChatPreferences,
  subscribeChatPreferences,
} from './chat-preferences-store';

describe('chat preferences store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setChatPreferences({ scope: 'nigeria', language: 'english' });
    window.localStorage.clear();
  });

  it('defaults to Nigeria first in English on the server and on a fresh device', () => {
    expect(getServerChatPreferences()).toEqual({
      scope: 'nigeria',
      language: 'english',
    });
    expect(getChatPreferences()).toEqual({
      scope: 'nigeria',
      language: 'english',
    });
  });

  it('merges partial updates, persists them, and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeChatPreferences(listener);
    setChatPreferences({ language: 'mix' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getChatPreferences()).toEqual({ scope: 'nigeria', language: 'mix' });
    expect(
      JSON.parse(
        window.localStorage.getItem(CHAT_PREFERENCES_STORAGE_KEY) ?? '',
      ),
    ).toEqual({
      scope: 'nigeria',
      language: 'mix',
    });
    unsubscribe();
    setChatPreferences({ scope: 'global' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('returns the same object while nothing changed, so useSyncExternalStore stays calm', () => {
    setChatPreferences({ scope: 'global' });
    expect(getChatPreferences()).toBe(getChatPreferences());
  });

  it('ignores corrupt or unknown stored values', () => {
    window.localStorage.setItem(CHAT_PREFERENCES_STORAGE_KEY, '{not json');
    expect(getChatPreferences()).toEqual({
      scope: 'nigeria',
      language: 'english',
    });
    window.localStorage.setItem(
      CHAT_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ scope: 'global', language: 'klingon' }),
    );
    expect(getChatPreferences()).toEqual({
      scope: 'global',
      language: 'english',
    });
  });
});
