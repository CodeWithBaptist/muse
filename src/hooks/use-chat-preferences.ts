'use client';

import * as React from 'react';
import type { ChatPreferences } from '@/lib/chat-preferences';
import {
  getChatPreferences,
  getServerChatPreferences,
  setChatPreferences,
  subscribeChatPreferences,
} from '@/lib/chat-preferences-store';

/** The visitor's scope and language choices, kept on the device. */
export function useChatPreferences(): [
  ChatPreferences,
  (next: Partial<ChatPreferences>) => void,
] {
  const preferences = React.useSyncExternalStore(
    subscribeChatPreferences,
    getChatPreferences,
    getServerChatPreferences,
  );
  return [preferences, setChatPreferences];
}
