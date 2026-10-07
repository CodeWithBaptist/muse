'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SpotifyTrackItem } from '@/lib/validation/api-schemas';

/**
 * What a refinement turn changed, as reported by the server.
 *
 * Present only when the turn narrowed an earlier request, so the interface can
 * say so instead of looking like an unrelated new search.
 */
export interface RefinementSummary {
  summary: string;
  excludedArtists: string[];
  excludedGenres: string[];
  avoided: string[];
  /** Rows that were already on screen and stayed there. */
  keptTracks: number;
  /** Rows that are new to the screen. */
  newTracks: number;
  /** Rows that left the screen, for any reason. */
  removedTracks: number;
  droppedAlreadyShown: number;
  droppedExcludedArtist: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tracks?: SpotifyTrackItem[];
  isPlaylistSuggestion?: boolean;
  isStreaming?: boolean;
  noResults?: boolean;
  refinement?: RefinementSummary;
}

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** Reads the refinement block off an API payload, ignoring anything malformed. */
export function parseRefinement(value: unknown): RefinementSummary | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.summary !== 'string' || candidate.summary.length === 0) {
    return undefined;
  }
  return {
    summary: candidate.summary,
    excludedArtists: stringArray(candidate.excludedArtists),
    excludedGenres: stringArray(candidate.excludedGenres),
    avoided: stringArray(candidate.avoided),
    keptTracks: typeof candidate.keptTracks === 'number' ? candidate.keptTracks : 0,
    newTracks: typeof candidate.newTracks === 'number' ? candidate.newTracks : 0,
    removedTracks:
      typeof candidate.removedTracks === 'number' ? candidate.removedTracks : 0,
    droppedAlreadyShown:
      typeof candidate.droppedAlreadyShown === 'number'
        ? candidate.droppedAlreadyShown
        : 0,
    droppedExcludedArtist:
      typeof candidate.droppedExcludedArtist === 'number'
        ? candidate.droppedExcludedArtist
        : 0,
  };
}

/**
 * The living recommendation list.
 *
 * One selection is edited in place across refinement turns rather than a new
 * list per reply, which is what lets rows that still fit stay where they are.
 */
export interface Selection {
  tracks: SpotifyTrackItem[];
  refinement?: RefinementSummary;
  isPlaylistSuggestion?: boolean;
  suggestedPlaylistName?: string;
  noResults?: boolean;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
}

interface ChatMutationInput {
  content: string;
  /** Track ids currently on screen, in screen order. */
  selectionIds: string[];
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
  if (typeof message === 'string' && /AI is not connected yet|OPENAI_API_KEY/i.test(message)) {
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

/** Attaches stored "Why this?" reasons to tracks loaded from history. */
function hydrateTracksWithReasons(
  rawMessages: Message[],
  recs: PersistedRecommendation[]
): Message[] {
  const reasonByTrackId = new Map<string, string>();
  for (const rec of recs) {
    if (rec.spotifyTrackId && rec.reason) {
      reasonByTrackId.set(rec.spotifyTrackId, rec.reason);
    }
  }

  return rawMessages.map((msg) => {
    if (!msg.tracks || msg.tracks.length === 0) return msg;
    return {
      ...msg,
      tracks: msg.tracks.map((track) => ({
        ...track,
        reason: track.reason || reasonByTrackId.get(track.id),
      })),
    };
  });
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
  const [selection, setSelection] = React.useState<Selection | null>(null);

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

  const hydratedHistory = React.useMemo<Message[]>(() => {
    const rawMessages: Message[] = Array.isArray(history?.messages)
      ? history.messages
      : [];
    const recs: PersistedRecommendation[] = Array.isArray(history?.recommendations)
      ? history.recommendations
      : [];
    return hydrateTracksWithReasons(rawMessages, recs);
  }, [history]);

  const messages = React.useMemo<Message[]>(() => {
    const combined = [...hydratedHistory, ...localMessages];
    if (streamingDraft !== null) {
      combined.push({
        role: 'assistant',
        content: streamingDraft,
        isStreaming: true,
      });
    }

    // Tracks are stripped here on purpose. The list is rendered once by the
    // selection panel, so a reply must not draw a second copy of it.
    return combined.map((message) =>
      message.tracks ? { ...message, tracks: undefined } : message
    );
  }, [hydratedHistory, localMessages, streamingDraft]);

  // A loaded conversation rebuilds its list from the most recent reply that
  // carried tracks, so the panel is not empty after a reload. This runs during
  // render guarded on which conversation was hydrated, which is how React asks
  // for state to be adjusted when the data beneath it changes. An effect would
  // paint one frame of the wrong list first.
  const hydratedConversationId = history?.conversation?.id ?? null;
  const [selectionHydratedFor, setSelectionHydratedFor] = React.useState<
    string | null
  >(null);

  if (hydratedConversationId !== selectionHydratedFor) {
    setSelectionHydratedFor(hydratedConversationId);

    const withTracks = hydratedHistory.filter(
      (message) => Array.isArray(message.tracks) && message.tracks.length > 0
    );
    const latest = withTracks[withTracks.length - 1];
    setSelection(
      latest?.tracks
        ? {
            tracks: latest.tracks,
            isPlaylistSuggestion: latest.isPlaylistSuggestion,
          }
        : null
    );
  }

  const chatMutation = useMutation({
    mutationFn: async ({ content, selectionIds }: ChatMutationInput) => {
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
          body: JSON.stringify({
            content,
            conversationId: activeConversationId,
            currentSelectionIds: selectionIds,
          }),
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

      const refinement = parseRefinement(data.refinement);
      const noResults = Boolean(data.noResults);
      const tracks = Array.isArray(data.tracks)
        ? (data.tracks as SpotifyTrackItem[])
        : undefined;

      setLocalMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: typeof data.content === 'string' ? data.content : '',
        },
      ]);

      // Only a discovery reply moves the list. A conversational reply leaves
      // whatever is on screen alone.
      if (tracks || noResults) {
        setSelection({
          tracks: tracks ?? [],
          refinement,
          isPlaylistSuggestion: Boolean(data.isPlaylistSuggestion),
          suggestedPlaylistName:
            typeof data.suggestedPlaylistName === 'string'
              ? data.suggestedPlaylistName
              : undefined,
          noResults,
        });
      }
      setIsThinking(false);
      void refetchConversations();
    },
    onError: () => {
      setStreamingDraft(null);
      setThinkingStage(null);
      setIsThinking(false);
    },
  });

  // The ids on screen are captured when the message is sent rather than read
  // from a ref during render, so the server always learns what the visitor was
  // actually looking at.
  const currentSelectionIds = React.useMemo(
    () => selection?.tracks.map((track) => track.id) ?? [],
    [selection]
  );

  const sendMessage = (content: string) => {
    setLastPrompt(content);
    setLocalMessages((prev) => [...prev, { role: 'user', content }]);
    chatMutation.mutate({ content, selectionIds: currentSelectionIds });
  };

  const retryLastMessage = () => {
    if (!lastPrompt || isThinking) return;
    chatMutation.mutate({ content: lastPrompt, selectionIds: currentSelectionIds });
  };

  const selectConversation = (id: string) => {
    setLocalMessages([]);
    setStreamingDraft(null);
    setThinkingStage(null);
    setSelection(null);
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
    selection,
    /** The panel reports removals so the next refinement knows what is on screen. */
    updateSelectionTracks: (tracks: SpotifyTrackItem[]) =>
      setSelection((previous) => (previous ? { ...previous, tracks } : previous)),
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
