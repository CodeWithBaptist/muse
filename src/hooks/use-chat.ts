'use client';

import * as React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { SpotifyTrackItem } from '@/lib/validation/api-schemas';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tracks?: SpotifyTrackItem[];
  isPlaylistSuggestion?: boolean;
}

interface ChatError extends Error {
  code?: string;
  status?: number;
}

export function isAiNotConnectedMessage(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  const message = (error as { message?: unknown }).message;
  if (code === 'AI_NOT_CONNECTED') return true;
  if (typeof message === 'string' && /AI is not connected yet|OPENAI_API_KEY/i.test(message)) {
    return true;
  }
  return false;
}

export function useChat(conversationId?: string) {
  const [localMessages, setLocalMessages] = React.useState<Message[]>([]);
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

  const { data: history } = useQuery({
    queryKey: ['chat', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const res = await fetch(`/api/chat/${conversationId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!conversationId,
    retry: false,
  });

  const messages = React.useMemo<Message[]>(() => {
    const base: Message[] = Array.isArray(history?.messages) ? history.messages : [];
    return [...base, ...localMessages];
  }, [history, localMessages]);

  const chatMutation = useMutation({
    mutationFn: async (content: string) => {
      setIsThinking(true);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, conversationId }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const err: ChatError = new Error(errBody.error || 'Failed to send message');
        err.code = errBody.code;
        err.status = res.status;
        throw err;
      }
      return res.json();
    },
    onSuccess: (data) => {
      setLocalMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.content,
          tracks: data.tracks,
          isPlaylistSuggestion: data.isPlaylistSuggestion,
        },
      ]);
      setIsThinking(false);
    },
    onError: () => {
      setIsThinking(false);
    },
  });

  const sendMessage = (content: string) => {
    setLocalMessages((prev) => [...prev, { role: 'user', content }]);
    chatMutation.mutate(content);
  };

  const error = chatMutation.error as ChatError | null;
  const isAiNotConnected =
    aiStatus?.connected === false || isAiNotConnectedMessage(error);

  return {
    messages,
    sendMessage,
    isThinking,
    error,
    isAiNotConnected,
  };
}
