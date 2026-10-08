import { NextResponse } from 'next/server';
import {
  chatCompletion,
  chatCompletionStream,
  sanitizePromptInput,
} from '@/lib/ai/provider';
import { extractChatIntent } from '@/lib/ai/recommendation-engine';
import { buildOpenPlaylist } from '@/lib/ai/playlist-engine';
import { verifyTracks, type VerifiedTrack } from '@/lib/catalogue';
import type { ChatHistoryTurn } from '@/lib/validation/api-schemas';
import { chatSystemPrompt } from '@/lib/ai/muse-prompt';
import {
  DEFAULT_CHAT_PREFERENCES,
  type ChatLanguage,
  type ChatPreferences,
} from '@/lib/chat-preferences';

/**
 * The chat path for visitors without an account.
 *
 * Nothing is written to the database: the browser keeps the conversation and
 * sends the recent turns back for context. Discovery requests get the JSON
 * playlist from the open engine; everything else gets a streamed reply. The
 * event shapes match the signed-in path so the chat screen has one parser.
 */

/** The reply prompt for the default preferences; kept for callers and tests. */
export const OPEN_CHAT_SYSTEM_PROMPT = chatSystemPrompt(
  DEFAULT_CHAT_PREFERENCES,
);

export const OPEN_PLAYLIST_FAILED_MESSAGE =
  'MUSE could not put a list together for that. Try describing the vibe a little differently.';

/** Status lines on the stream, in the visitor's chosen language. */
export const OPEN_CHAT_STAGES: Record<
  ChatLanguage,
  {
    understanding: string;
    building: string;
    checking: string;
    composing: string;
  }
> = {
  english: {
    understanding: 'Understanding your vibe',
    building: 'Building your list',
    checking: 'Checking the songs against the catalogue',
    composing: 'Composing response',
  },
  pidgin: {
    understanding: 'Dey feel your vibe...',
    building: 'Dey cook your playlist...',
    checking: 'Dey confirm say the songs dey...',
    composing: 'Dey arrange reply...',
  },
  mix: {
    understanding: 'Reading the vibe',
    building: 'Dey cook your playlist...',
    checking: 'Checking the songs against the catalogue',
    composing: 'Composing response',
  },
};

export interface OpenChatInput {
  content: string;
  history: ChatHistoryTurn[];
  preferences: ChatPreferences;
}

export interface OpenPlaylistPayload {
  role: 'assistant';
  content: string;
  intent: string;
  recommendations: VerifiedTrack[];
  playlistTitle: string;
  isPlaylistSuggestion: true;
  noResults: boolean;
  short: boolean;
  /** Picks left out because no catalogue knew the artist. */
  dropped: number;
}

export interface OpenReplyPayload {
  role: 'assistant';
  content: string;
  intent: string;
}

function encodeSseEvent(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function historyAsMessages(history: ChatHistoryTurn[]) {
  return history.map((turn) => ({
    role: turn.role,
    content: sanitizePromptInput(turn.content, 1000),
  }));
}

/**
 * Builds the list, then checks it against the catalogues. `onChecking` fires
 * between the two so a stream can show the second stage.
 */
export async function composePlaylist(
  input: OpenChatInput,
  intent: string,
  onChecking?: () => void,
): Promise<OpenPlaylistPayload> {
  const playlist = await buildOpenPlaylist(input.content, input.history, {
    preferences: input.preferences,
  });
  onChecking?.();
  const checked = await verifyTracks(playlist.tracks);
  return {
    role: 'assistant',
    content: playlist.intro,
    intent,
    recommendations: checked.tracks,
    playlistTitle: playlist.title,
    isPlaylistSuggestion: true,
    noResults: checked.tracks.length === 0,
    short: playlist.short || checked.tracks.length < playlist.tracks.length,
    dropped: checked.dropped.length,
  };
}

function replyMessages(input: OpenChatInput) {
  return [
    { role: 'system' as const, content: chatSystemPrompt(input.preferences) },
    ...historyAsMessages(input.history),
    { role: 'user' as const, content: sanitizePromptInput(input.content, 500) },
  ];
}

/** Non-streaming answer, used by callers that did not ask for events. */
export async function answerOpenChat(
  input: OpenChatInput,
): Promise<OpenPlaylistPayload | OpenReplyPayload> {
  const classified = await extractChatIntent(input.content);
  if (classified.isDiscovery) {
    return composePlaylist(input, classified.intent);
  }
  const response = await chatCompletion(replyMessages(input));
  const choices = (
    response as { choices?: Array<{ message?: { content?: string | null } }> }
  ).choices;
  return {
    role: 'assistant',
    content: choices?.[0]?.message?.content ?? '',
    intent: classified.intent,
  };
}

/**
 * Streams status, deltas, and a final done event. Errors are reported on the
 * stream with a code; `onError` lets the route log them its own way.
 */
export function streamOpenChat(
  input: OpenChatInput,
  onError: (error: unknown) => Uint8Array,
): Response {
  const stages = OPEN_CHAT_STAGES[input.preferences.language];
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(
          encodeSseEvent({
            type: 'status',
            stage: stages.understanding,
          }),
        );
        const classified = await extractChatIntent(input.content);

        if (classified.isDiscovery) {
          controller.enqueue(
            encodeSseEvent({
              type: 'status',
              stage: stages.building,
            }),
          );
          let payload: OpenPlaylistPayload;
          try {
            payload = await composePlaylist(input, classified.intent, () =>
              controller.enqueue(
                encodeSseEvent({ type: 'status', stage: stages.checking }),
              ),
            );
          } catch (playlistError) {
            onError(playlistError);
            controller.enqueue(
              encodeSseEvent({
                type: 'error',
                error: OPEN_PLAYLIST_FAILED_MESSAGE,
                code: 'AI_ERROR',
              }),
            );
            return;
          }
          for (const chunk of payload.content.split(/(\s+)/)) {
            if (chunk)
              controller.enqueue(
                encodeSseEvent({ type: 'delta', delta: chunk }),
              );
          }
          controller.enqueue(encodeSseEvent({ type: 'done', ...payload }));
          return;
        }

        controller.enqueue(
          encodeSseEvent({ type: 'status', stage: stages.composing }),
        );
        let content = '';
        for await (const delta of chatCompletionStream(replyMessages(input))) {
          content += delta;
          controller.enqueue(encodeSseEvent({ type: 'delta', delta }));
        }
        const reply: OpenReplyPayload = {
          role: 'assistant',
          content,
          intent: classified.intent,
        };
        controller.enqueue(encodeSseEvent({ type: 'done', ...reply }));
      } catch (error) {
        controller.enqueue(onError(error));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

export function openPlaylistFailure(): NextResponse {
  return NextResponse.json(
    { error: OPEN_PLAYLIST_FAILED_MESSAGE, code: 'AI_ERROR' },
    { status: 502 },
  );
}
