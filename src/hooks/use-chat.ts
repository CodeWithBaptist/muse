'use client';

import * as React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tracks?: any[];
}

export function useChat(conversationId?: string) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isThinking, setIsThinking] = React.useState(false);

  const { data: history } = useQuery({
    queryKey: ['chat', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const res = await fetch(`/api/chat/${conversationId}`);
      return res.json();
    },
    enabled: !!conversationId,
  });

  React.useEffect(() => {
    if (history?.messages) {
      setMessages(history.messages);
    }
  }, [history]);

  const chatMutation = useMutation({
    mutationFn: async (content: string) => {
      setIsThinking(true);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, conversationId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to send message');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: 'assistant', content: data.content, tracks: data.tracks }]);
      setIsThinking(false);
    },
    onError: () => {
      setIsThinking(false);
    }
  });

  const sendMessage = (content: string) => {
    setMessages((prev) => [...prev, { role: 'user', content }]);
    chatMutation.mutate(content);
  };

  return {
    messages,
    sendMessage,
    isThinking,
    error: chatMutation.error as Error | null,
  };
}
