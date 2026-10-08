import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GUEST_CHAT_STORAGE_KEY,
  appendGuestMessage,
  clearGuestMessages,
  getGuestMessages,
  getServerGuestMessages,
  parseStoredMessages,
  setGuestMessages,
  subscribeGuestMessages,
} from './guest-chat-store';
import { historyForRequest } from '@/hooks/use-chat';

describe('guest chat store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearGuestMessages();
  });

  it('keeps the same array until the stored text changes, and is empty on the server', () => {
    expect(getServerGuestMessages()).toEqual([]);
    const first = getGuestMessages();
    expect(first).toEqual([]);
    expect(getGuestMessages()).toBe(first);

    appendGuestMessage({ role: 'user', content: 'Owambe' });
    const second = getGuestMessages();
    expect(second).not.toBe(first);
    expect(second).toEqual([{ role: 'user', content: 'Owambe' }]);
    expect(getGuestMessages()).toBe(second);
  });

  it('drops streaming drafts, keeps the last forty, and clears cleanly', () => {
    const many = Array.from({ length: 45 }, (_, i) => ({
      role: 'user' as const,
      content: `m${i}`,
    }));
    setGuestMessages([
      ...many,
      { role: 'assistant', content: 'draft', isStreaming: true },
    ]);
    const stored = getGuestMessages();
    expect(stored).toHaveLength(40);
    expect(stored[0].content).toBe('m5');
    expect(stored.some((m) => m.isStreaming)).toBe(false);

    clearGuestMessages();
    expect(window.localStorage.getItem(GUEST_CHAT_STORAGE_KEY)).toBeNull();
    expect(getGuestMessages()).toEqual([]);
  });

  it('notifies subscribers on writes and ignores junk in storage', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeGuestMessages(listener);
    appendGuestMessage({ role: 'assistant', content: 'hi' });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    appendGuestMessage({ role: 'assistant', content: 'again' });
    expect(listener).toHaveBeenCalledTimes(1);

    expect(parseStoredMessages('not json')).toEqual([]);
    expect(parseStoredMessages('{"a":1}')).toEqual([]);
    expect(
      parseStoredMessages(
        JSON.stringify([
          { role: 'system', content: 'x' },
          { role: 'user', content: 'ok' },
          'junk',
        ]),
      ),
    ).toEqual([{ role: 'user', content: 'ok' }]);
  });

  it('builds request history from the stored turns without repeating the question', () => {
    setGuestMessages([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply', isStreaming: false },
      { role: 'user', content: 'again' },
    ]);
    expect(historyForRequest(getGuestMessages(), 'again')).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply' },
    ]);
    expect(historyForRequest(getGuestMessages(), 'different')).toHaveLength(3);

    const long = Array.from({ length: 14 }, (_, i) => ({
      role: 'user' as const,
      content: `turn ${i}`,
    }));
    expect(historyForRequest(long, 'new')).toHaveLength(10);
    expect(historyForRequest(long, 'new')[0].content).toBe('turn 4');
  });
});
