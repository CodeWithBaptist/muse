'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SpotifyTrackItem } from '@/lib/validation/api-schemas';
import type { ListedTrack } from '@/lib/catalogue/types';
import { useAuth } from '@/hooks/use-auth';
import { useChatPreferences } from '@/hooks/use-chat-preferences';
import { compactTaste } from '@/lib/taste/types';
import { getTasteSnapshot } from '@/lib/taste/store';
import { setVibe } from '@/lib/vibe-store';
import {
  appendGuestMessage,
  clearGuestMessages,
  getGuestMessages,
  getServerGuestMessages,
  subscribeGuestMessages,
} from '@/lib/guest-chat-store';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** Spotify-backed tracks from the signed-in path. */
  tracks?: SpotifyTrackItem[];
  /** Model-picked tracks from the open path (title, artist, why, region). */
  recommendations?: ListedTrack[];
  /** Picks left out by the catalogue check because no service knew the artist. */
  dropped?: number;
  playlistTitle?: string;
  /** True when the open engine returned fewer than it aims for. */
  short?: boolean;
  isPlaylistSuggestion?: boolean;
  isStreaming?: boolean;
  noResults?: boolean;
}

/** The listening snapshot on this device, trimmed for the prompt; nothing at all when there is none. */
function tasteForRequest(): { taste?: ReturnType<typeof compactTaste> } {
  const snapshot = getTasteSnapshot();
  return snapshot ? { taste: compactTaste(snapshot) } : {};
}

/**
 * The recent turns to send with a message. A trailing copy of the message
 * itself (already shown optimistically, or left over from a failed attempt)
 * is dropped so the model does not read the question twice.
 */
export function historyForRequest(
  messages: readonly Message[],
  content: string,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const turns = messages.filter(
    (message): message is Message & { role: 'user' | 'assistant' } =>
      (message.role === 'user' || message.role === 'assistant') &&
      !message.isStreaming &&
      message.content.trim().length > 0,
  );
  const last = turns[turns.length - 1];
  const trimmed =
    last && last.role === 'user' && last.content === content
      ? turns.slice(0, -1)
      : turns;
  return trimmed.slice(-HISTORY_TURNS_FOR_CONTEXT).map((turn) => ({
    role: turn.role,
    content: turn.content.slice(0, 1000),
  }));
}

const HISTORY_TURNS_FOR_CONTEXT = 10;

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
}

interface PersistedRecommendation {
  spotifyTrackId: string;
  reason?: string | null;
}

export type ChatErrorKind =
  | 'ai_not_connected'
  | 'ai_resting'
  | 'human_check'
  | 'spotify_disconnected'
  | 'spotify_error'
  | 'rate_limited'
  | 'offline'
  | 'ai_error';

export interface ChatError extends Error {
  code?: string;
  status?: number;
  kind?: ChatErrorKind;
}

export function isAiNotConnectedMessage(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  const message = (error as { message?: unknown }).message;
  if (code === 'AI_NOT_CONNECTED') return true;
  if (
    typeof message === 'string' &&
    /AI is not connected yet|OPENAI_API_KEY/i.test(message)
  ) {
    return true;
  }
  return false;
}

export function classifyChatError(error: unknown): ChatErrorKind | null {
  if (!error || typeof error !== 'object') return null;
  if (isAiNotConnectedMessage(error)) return 'ai_not_connected';

  const code = (error as { code?: unknown }).code;
  const status = (error as { status?: unknown }).status;
  const message = String((error as { message?: unknown }).message ?? '');

  if (
    code === 'OFFLINE' ||
    /offline|failed to fetch|networkerror/i.test(message)
  ) {
    return 'offline';
  }
  if (code === 'AI_RESTING' || /MUSE is resting/i.test(message)) {
    return 'ai_resting';
  }
  if (code === 'HUMAN_CHECK_REQUIRED') {
    return 'human_check';
  }
  if (
    code === 'RATE_LIMITED' ||
    status === 429 ||
    /too many requests|rate limit/i.test(message)
  ) {
    return 'rate_limited';
  }
  if (
    code === 'SPOTIFY_DISCONNECTED' ||
    code === 'SPOTIFY_RECONNECT_REQUIRED' ||
    status === 401 ||
    /spotify connection expired|reconnect your spotify|unauthorized/i.test(
      message,
    )
  ) {
    return 'spotify_disconnected';
  }
  if (
    code === 'SPOTIFY_ERROR' ||
    /spotify could not be reached|spotify api/i.test(message)
  ) {
    return 'spotify_error';
  }
  return 'ai_error';
}

export function useChat(initialConversationId?: string) {
  const queryClient = useQueryClient();
  const { authenticated, isLoading: authLoading } = useAuth();
  // A guest is anyone without an account once the session check has answered.
  const isGuest = !authLoading && !authenticated;
  // Without an account the conversation lives on the device, not in state.
  const guestMessages = React.useSyncExternalStore(
    subscribeGuestMessages,
    getGuestMessages,
    getServerGuestMessages,
  );
  const [preferences, setPreferences] = useChatPreferences();
  const [activeConversationId, setActiveConversationId] = React.useState<
    string | undefined
  >(initialConversationId);
  const [localMessages, setLocalMessages] = React.useState<Message[]>([]);
  const [streamingDraft, setStreamingDraft] = React.useState<string | null>(
    null,
  );
  const [thinkingStage, setThinkingStage] = React.useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = React.useState<string>('');
  const [isThinking, setIsThinking] = React.useState(false);

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/ai/status');
        if (!res || !res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },
    retry: false,
  });

  const { data: conversations = [], refetch: refetchConversations } = useQuery<
    ConversationSummary[]
  >({
    queryKey: ['chat-conversations'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/chat');
        if (!res || !res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
    enabled: authenticated,
    retry: false,
  });

  const { data: history } = useQuery({
    queryKey: ['chat', activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return null;
      const res = await fetch(`/api/chat/${activeConversationId}`);
      if (!res || !res.ok) return null;
      return res.json();
    },
    enabled: authenticated && !!activeConversationId,
    retry: false,
  });

  const messages = React.useMemo<Message[]>(() => {
    const rawMessages: Message[] = Array.isArray(history?.messages)
      ? history.messages
      : [];
    const recs: PersistedRecommendation[] = Array.isArray(
      history?.recommendations,
    )
      ? history.recommendations
      : [];
    const reasonByTrackId = new Map<string, string>();
    for (const rec of recs) {
      if (rec.spotifyTrackId && rec.reason) {
        reasonByTrackId.set(rec.spotifyTrackId, rec.reason);
      }
    }

    const hydratedBase = rawMessages.map((msg) => {
      if (!msg.tracks || msg.tracks.length === 0) return msg;
      return {
        ...msg,
        tracks: msg.tracks.map((track) => ({
          ...track,
          reason: track.reason || reasonByTrackId.get(track.id),
        })),
      };
    });

    const combined = authenticated
      ? [...hydratedBase, ...localMessages]
      : [...guestMessages];
    if (streamingDraft !== null) {
      combined.push({
        role: 'assistant',
        content: streamingDraft,
        isStreaming: true,
      });
    }
    return combined;
  }, [authenticated, guestMessages, history, localMessages, streamingDraft]);

  const chatMutation = useMutation({
    mutationFn: async (content: string) => {
      setIsThinking(true);
      setThinkingStage(null);
      setStreamingDraft(null);

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const offlineErr: ChatError = new Error(
          'You appear to be offline. Check your connection and try again.',
        );
        offlineErr.code = 'OFFLINE';
        offlineErr.kind = 'offline';
        throw offlineErr;
      }

      let res: Response;
      try {
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream, application/json',
          },
          body: JSON.stringify(
            authenticated
              ? {
                  content,
                  conversationId: activeConversationId,
                  preferences,
                  ...tasteForRequest(),
                }
              : {
                  content,
                  history: historyForRequest(getGuestMessages(), content),
                  preferences,
                  ...tasteForRequest(),
                },
          ),
        });
      } catch {
        const netErr: ChatError = new Error(
          'You appear to be offline. Check your connection and try again.',
        );
        netErr.code = 'OFFLINE';
        netErr.kind = 'offline';
        throw netErr;
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const err: ChatError = new Error(
          errBody.error || 'Failed to send message',
        );
        err.code = errBody.code;
        err.status = res.status;
        err.kind = classifyChatError(err) ?? 'ai_error';
        throw err;
      }

      const contentType = res.headers?.get?.('content-type') ?? '';
      if (contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedText = '';
        let finalPayload: Record<string, unknown> | null = null;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';

          for (const rawEvent of events) {
            const line = rawEvent
              .split('\n')
              .find((l) => l.startsWith('data: '));
            if (!line) continue;
            const jsonStr = line.slice('data: '.length).trim();
            if (!jsonStr) continue;

            const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
            if (parsed.type === 'status' && typeof parsed.stage === 'string') {
              setThinkingStage(parsed.stage);
            } else if (
              parsed.type === 'delta' &&
              typeof parsed.delta === 'string'
            ) {
              accumulatedText += parsed.delta;
              setStreamingDraft(accumulatedText);
            } else if (parsed.type === 'error') {
              const streamErr: ChatError = new Error(
                typeof parsed.error === 'string'
                  ? parsed.error
                  : 'Unable to process chat request right now.',
              );
              streamErr.code =
                typeof parsed.code === 'string' ? parsed.code : 'AI_ERROR';
              streamErr.kind = classifyChatError(streamErr) ?? 'ai_error';
              throw streamErr;
            } else if (parsed.type === 'done') {
              finalPayload = parsed;
            }
          }
        }

        setStreamingDraft(null);
        setThinkingStage(null);
        if (finalPayload) {
          return finalPayload;
        }
        return {
          conversationId: activeConversationId,
          role: 'assistant',
          content: accumulatedText,
        };
      }

      return res.json();
    },
    onSuccess: (data: Record<string, unknown>) => {
      setStreamingDraft(null);
      setThinkingStage(null);

      if (typeof data.conversationId === 'string' && !activeConversationId) {
        setActiveConversationId(data.conversationId);
      }

      const reply: Message = {
        role: 'assistant',
        content: typeof data.content === 'string' ? data.content : '',
        tracks: Array.isArray(data.tracks)
          ? (data.tracks as SpotifyTrackItem[])
          : undefined,
        recommendations: Array.isArray(data.recommendations)
          ? (data.recommendations as ListedTrack[])
          : undefined,
        playlistTitle:
          typeof data.playlistTitle === 'string'
            ? data.playlistTitle
            : undefined,
        short: Boolean(data.short),
        dropped: typeof data.dropped === 'number' ? data.dropped : undefined,
        isPlaylistSuggestion: Boolean(data.isPlaylistSuggestion),
        noResults: Boolean(data.noResults),
      };
      if (authenticated) {
        setLocalMessages((prev) => [...prev, reply]);
        void refetchConversations();
      } else {
        appendGuestMessage(reply);
      }
      setIsThinking(false);
    },
    onError: () => {
      setStreamingDraft(null);
      setThinkingStage(null);
      setIsThinking(false);
    },
  });

  const sendMessage = (content: string) => {
    setLastPrompt(content);
    setVibe(content);
    if (authenticated) {
      setLocalMessages((prev) => [...prev, { role: 'user', content }]);
    } else {
      appendGuestMessage({ role: 'user', content });
    }
    chatMutation.mutate(content);
  };

  const retryLastMessage = () => {
    if (!lastPrompt || isThinking) return;
    chatMutation.mutate(lastPrompt);
  };

  const selectConversation = (id: string) => {
    setLocalMessages([]);
    setStreamingDraft(null);
    setThinkingStage(null);
    chatMutation.reset();
    setActiveConversationId(id);
  };

  const startNewChat = () => {
    setLocalMessages([]);
    if (!authenticated) clearGuestMessages();
    setStreamingDraft(null);
    setThinkingStage(null);
    chatMutation.reset();
    setActiveConversationId(undefined);
  };

  const deleteConversation = async (id: string) => {
    const res = await fetch(`/api/chat/${id}`, { method: 'DELETE' });
    if (res.ok) {
      if (activeConversationId === id) {
        startNewChat();
      }
      await queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    }
  };

  const error = chatMutation.error as ChatError | null;
  const errorKind = classifyChatError(error);
  const isAiNotConnected =
    aiStatus?.connected === false || errorKind === 'ai_not_connected';

  return {
    messages,
    isGuest,
    preferences,
    setPreferences,
    sendMessage,
    retryLastMessage,
    isThinking,
    thinkingStage,
    lastPrompt,
    error,
    errorKind,
    isAiNotConnected,
    conversations,
    activeConversationId,
    selectConversation,
    startNewChat,
    deleteConversation,
  };
}
