'use client';

import * as React from 'react';
import { useChat, type ChatErrorKind } from '@/hooks/use-chat';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { ThinkingIndicator } from '@/components/chat/ThinkingIndicator';
import {
  AlertCircle,
  Clock,
  History,
  MessageSquarePlus,
  RefreshCw,
  Sparkles,
  Terminal,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const SUGGESTED_PROMPTS = [
  'Late night Afrobeats',
  'Something completely new',
  'Songs like Brent Faiyaz but less sad',
  'Music for a 2am drive',
  'Ambient study session',
  '90s Hip Hop deep cuts',
];

function AiNotConnectedBanner() {
  return (
    <Surface
      data-testid="ai-not-connected-state"
      className="p-6 border-border-strong bg-surface/80 flex items-start gap-4 rounded-xl"
    >
      <Sparkles className="text-accent shrink-0 mt-0.5" size={20} />
      <div className="space-y-2">
        <h2 className="text-sm font-bold text-text-primary tracking-wide">
          AI is not connected yet
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          MUSE needs an OpenAI API key to respond in chat and curate recommendations. Add{' '}
          <code className="text-xs font-mono text-text-primary bg-background/60 px-1.5 py-0.5 rounded">
            OPENAI_API_KEY
          </code>{' '}
          to your environment variables to enable AI features.
        </p>
        <div className="flex items-center gap-2 pt-1 text-[10px] text-text-muted font-mono uppercase tracking-wider">
          <Terminal size={12} />
          <span>Set OPENAI_API_KEY in .env.local or Vercel</span>
        </div>
      </div>
    </Surface>
  );
}

interface DistinctErrorBannerProps {
  kind: Exclude<ChatErrorKind, 'ai_not_connected'>;
  message: string;
  onRetry: () => void;
}

function DistinctChatErrorBanner({
  kind,
  message,
  onRetry,
}: DistinctErrorBannerProps) {
  const meta: Record<
    Exclude<ChatErrorKind, 'ai_not_connected'>,
    {
      title: string;
      description: string;
      icon: typeof AlertCircle;
      action: 'reconnect' | 'retry' | 'none';
    }
  > = {
    spotify_disconnected: {
      title: 'Spotify disconnected',
      description:
        'Your Spotify session has expired or needs to be connected before MUSE can search tracks.',
      icon: AlertCircle,
      action: 'reconnect',
    },
    spotify_error: {
      title: 'Spotify error',
      description:
        message || 'Spotify could not be reached right now. Please try again in a moment.',
      icon: AlertCircle,
      action: 'retry',
    },
    rate_limited: {
      title: 'Rate limited',
      description:
        message || 'Too many requests in a short window. Wait a moment and try again.',
      icon: Clock,
      action: 'retry',
    },
    offline: {
      title: 'You are offline',
      description:
        'Check your network connection and retry your message once you are back online.',
      icon: WifiOff,
      action: 'retry',
    },
    ai_error: {
      title: 'AI error',
      description:
        message || 'MUSE could not complete that response right now. Please try again.',
      icon: AlertCircle,
      action: 'retry',
    },
  };

  const config = meta[kind];
  const Icon = config.icon;

  return (
    <Surface
      data-testid={`chat-error-${kind}`}
      className="p-6 border-border-strong bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl"
    >
      <div className="flex items-start gap-4">
        <Icon className="text-accent shrink-0 mt-0.5" size={20} />
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-text-primary">{config.title}</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            {config.description}
          </p>
        </div>
      </div>

      <div className="shrink-0 pl-9 sm:pl-0">
        {config.action === 'reconnect' && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              window.location.href = '/api/auth/spotify';
            }}
          >
            Reconnect Spotify
          </Button>
        )}
        {config.action === 'retry' && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw size={14} className="mr-2" />
            Try again
          </Button>
        )}
      </div>
    </Surface>
  );
}

export default function ChatPage() {
  const {
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
  } = useChat();

  const [historyOpen, setHistoryOpen] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking, error, isAiNotConnected]);

  return (
    <div className="h-full flex flex-col relative">
      {/* Top conversation history bar */}
      <div className="px-6 py-3 border-b border-border-subtle flex items-center justify-between gap-4 bg-background">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setHistoryOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface border border-border-subtle transition-colors"
            aria-expanded={historyOpen}
          >
            <History size={14} />
            <span>History ({conversations.length})</span>
          </button>
          {activeConversationId && (
            <span className="text-xs text-text-muted truncate">
              {conversations.find((c) => c.id === activeConversationId)?.title ||
                'Active conversation'}
            </span>
          )}
        </div>

        {(messages.length > 0 || activeConversationId) && (
          <button
            type="button"
            onClick={startNewChat}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-accent hover:bg-surface transition-colors"
          >
            <MessageSquarePlus size={14} />
            <span>New chat</span>
          </button>
        )}
      </div>

      {/* Collapsible conversation history drawer */}
      {historyOpen && (
        <div
          data-testid="conversation-history-panel"
          className="px-6 py-4 border-b border-border-subtle bg-surface/60 max-h-60 overflow-y-auto"
        >
          <div className="max-w-4xl mx-auto space-y-2">
            {conversations.length === 0 ? (
              <p className="text-xs text-text-muted py-2">
                No saved conversations yet. Start a conversation below.
              </p>
            ) : (
              conversations.map((conv) => {
                const isSelected = conv.id === activeConversationId;
                return (
                  <div
                    key={conv.id}
                    className={cn(
                      'flex items-center justify-between gap-3 px-3 py-2 rounded-md text-xs transition-colors',
                      isSelected
                        ? 'bg-surface border border-border-strong text-text-primary font-semibold'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        selectConversation(conv.id);
                        setHistoryOpen(false);
                      }}
                      className="flex-1 text-left truncate"
                    >
                      {conv.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteConversation(conv.id)}
                      aria-label={`Delete conversation ${conv.title}`}
                      className="p-1 text-text-muted hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-8 space-y-12 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="max-w-4xl mx-auto pt-12 space-y-12 pb-24">
            <div className="space-y-4">
              <h1 className="type-page-title !text-[clamp(32px,5vw,40px)]">
                What are we listening to?
              </h1>
              <p className="text-text-secondary text-lg font-medium">
                Tell me the mood, sound, artist, or moment.
              </p>
            </div>

            {isAiNotConnected && <AiNotConnectedBanner />}

            {error && !isAiNotConnected && errorKind && errorKind !== 'ai_not_connected' && (
              <DistinctChatErrorBanner
                kind={errorKind}
                message={error.message}
                onRetry={retryLastMessage}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="p-6 text-left rounded-xl bg-surface border border-border-subtle hover:border-accent/50 hover:bg-surface/80 transition-all group"
                >
                  <div className="text-sm font-semibold text-text-secondary group-hover:text-text-primary transition-colors">
                    {prompt}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-12 pb-24">
            {messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))}

            {isThinking && (
              <div className="mr-auto">
                <ThinkingIndicator stage={thinkingStage} prompt={lastPrompt} />
              </div>
            )}

            {isAiNotConnected && <AiNotConnectedBanner />}

            {error && !isAiNotConnected && errorKind && errorKind !== 'ai_not_connected' && (
              <DistinctChatErrorBanner
                kind={errorKind}
                message={error.message}
                onRetry={retryLastMessage}
              />
            )}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-background/95 border-t border-border-subtle">
        <div className="max-w-4xl mx-auto">
          <ChatInput
            onSend={sendMessage}
            disabled={isThinking}
            placeholder={
              isAiNotConnected
                ? 'AI is not connected yet. Set OPENAI_API_KEY to start chatting.'
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
