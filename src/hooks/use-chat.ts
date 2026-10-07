'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SpotifyTrackItem } from '@/lib/validation/api-schemas';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tracks?: SpotifyTrackItem[];
  isPlaylistSuggestion?: boolean;
  isStreaming?: boolean;
  noResults?: boolean;
}

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
    /AI is not connected yet|ANTHROPIC_API_KEY|GEMINI_API_KEY/i.test(message)
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

  if (code === 'OFFLINE' || /offline|failed to fetch|networkerror/i.test(message)) {
    return 'offline';
  }
  if (code === 'RATE_LIMITED' || status === 429 || /too many requests|rate limit/i.test(message)) {
    return 'rate_limited';
  }
  if (
    code === 'SPOTIFY_DISCONNECTED' ||
    code === 'SPOTIFY_RECONNECT_REQUIRED' ||
    status === 401 ||
    /spotify connection expired|reconnect your spotify|unauthorized/i.test(message)
  ) {
    return 'spotify_disconnected';
  }
  if (code === 'SPOTIFY_ERROR' || /spotify could not be reached|spotify api/i.test(message)) {
    return 'spotify_error';
  }
  return 'ai_error';
}

export function useChat(initialConversationId?: string) {
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = React.useState<string | undefined>(
    initialConversationId
  );
  const [localMessages, setLocalMessages] = React.useState<Message[]>([]);
  const [streamingDraft, setStreamingDraft] = React.useState<string | null>(null);
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
    enabled: !!activeConversationId,
    retry: false,
  });

  const messages = React.useMemo<Message[]>(() => {
    const rawMessages: Message[] = Array.isArray(history?.messages) ? history.messages : [];
    const recs: PersistedRecommendation[] = Array.isArray(history?.recommendations)
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

    const combined = [...hydratedBase, ...localMessages];
    if (streamingDraft !== null) {
      combined.push({
        role: 'assistant',
        content: streamingDraft,
        isStreaming: true,
      });
    }
    return combined;
  }, [history, localMessages, streamingDraft]);

  const chatMutation = useMutation({
    mutationFn: async (content: string) => {
      setIsThinking(true);
      setThinkingStage(null);
      setStreamingDraft(null);

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const offlineErr: ChatError = new Error(
          'You appear to be offline. Check your connection and try again.'
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
          body: JSON.stringify({ content, conversationId: activeConversationId }),
        });
      } catch {
        const netErr: ChatError = new Error(
          'You appear to be offline. Check your connection and try again.'
        );
        netErr.code = 'OFFLINE';
        netErr.kind = 'offline';
        throw netErr;
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const err: ChatError = new Error(errBody.error || 'Failed to send message');
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
            } else if (parsed.type === 'delta' && typeof parsed.delta === 'string') {
              accumulatedText += parsed.delta;
              setStreamingDraft(accumulatedText);
            } else if (parsed.type === 'error') {
              const streamErr: ChatError = new Error(
                typeof parsed.error === 'string'
                  ? parsed.error
                  : 'Unable to process chat request right now.'
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

      setLocalMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: typeof data.content === 'string' ? data.content : '',
          tracks: Array.isArray(data.tracks)
            ? (data.tracks as SpotifyTrackItem[])
            : undefined,
          isPlaylistSuggestion: Boolean(data.isPlaylistSuggestion),
          noResults: Boolean(data.noResults),
        },
      ]);
      setIsThinking(false);
      void refetchConversations();
    },
    onError: () => {
      setStreamingDraft(null);
      setThinkingStage(null);
      setIsThinking(false);
    },
  });

  const sendMessage = (content: string) => {
    setLastPrompt(content);
    setLocalMessages((prev) => [...prev, { role: 'user', content }]);
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
