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
  Smartphone,
  KeyRound,
  Terminal,
  Trash2,
  WifiOff,
  Moon,
} from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import { HumanCheckCard } from '@/components/security/HumanCheckCard';
import { ChatPreferenceControls } from '@/components/chat/ChatPreferenceControls';
import { VibeChips } from '@/components/chat/VibeChips';
import { TasteHint } from '@/components/chat/TasteHint';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

function AiNotConnectedBanner() {
  return (
    <Surface
      role="status"
      data-testid="ai-not-connected-state"
      className="p-6 border-border-strong bg-surface/80 flex items-start gap-4 rounded-xl"
    >
      <KeyRound className="text-accent shrink-0 mt-0.5" size={20} />
      <div className="space-y-2">
        <h2 className="text-sm font-bold text-text-primary tracking-wide">
          AI is not connected yet
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          MUSE needs an OpenAI API key to respond in chat and curate
          recommendations. Add{' '}
          <code className="text-xs font-mono text-text-primary bg-background/60 px-1.5 py-0.5 rounded">
            OPENAI_API_KEY
          </code>{' '}
          to the environment and restart.
        </p>
        <div className="flex items-center gap-2 pt-1 text-[10px] text-text-muted font-mono uppercase tracking-wider">
          <Terminal size={12} />
          <span>Set OPENAI_API_KEY in .env.local or Vercel</span>
        </div>
      </div>
    </Surface>
  );
}

type BannerErrorKind = Exclude<
  ChatErrorKind,
  'ai_not_connected' | 'human_check'
>;

interface DistinctErrorBannerProps {
  kind: BannerErrorKind;
  message: string;
  onRetry: () => void;
}

function DistinctChatErrorBanner({
  kind,
  message,
  onRetry,
}: DistinctErrorBannerProps) {
  const meta: Record<
    BannerErrorKind,
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
        message ||
        'Spotify could not be reached right now. Please try again in a moment.',
      icon: AlertCircle,
      action: 'retry',
    },
    ai_resting: {
      title: 'MUSE is resting',
      description:
        message ||
        'MUSE has reached its daily limit for AI answers. It will be back after midnight, Lagos time.',
      icon: Moon,
      action: 'none',
    },
    rate_limited: {
      title: 'Rate limited',
      description:
        message ||
        'Too many requests in a short window. Wait a moment and try again.',
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
        message ||
        'MUSE could not complete that response right now. Please try again.',
      icon: AlertCircle,
      action: 'retry',
    },
  };

  const config = meta[kind];
  const Icon = config.icon;

  return (
    <Surface
      role="alert"
      aria-live="assertive"
      data-testid={`chat-error-${kind}`}
      className="p-6 border-border-strong bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl"
    >
      <div className="flex items-start gap-4">
        <Icon className="text-accent shrink-0 mt-0.5" size={20} />
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-text-primary">
            {config.title}
          </h3>
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
    isGuest,
    preferences,
    setPreferences,
    sendMessage,
    retryLastMessage,
    isThinking,
    thinkingStage,
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
      <div className="px-4 sm:px-6 py-3 border-b border-border-subtle flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-background">
        <div className="flex items-center gap-3 min-w-0">
          {isGuest ? (
            <span
              data-testid="chat-on-device-note"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold text-text-secondary border border-border-subtle"
            >
              <Smartphone size={14} aria-hidden="true" />
              <span>Saved on this device only</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setHistoryOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface border border-border-subtle transition-colors"
              aria-expanded={historyOpen}
              aria-controls="conversation-history-panel"
            >
              <History size={14} />
              <span>History ({conversations.length})</span>
            </button>
          )}
          {activeConversationId && (
            <span className="text-xs text-text-muted truncate">
              {conversations.find((c) => c.id === activeConversationId)
                ?.title || 'Active conversation'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ChatPreferenceControls
            preferences={preferences}
            onChange={setPreferences}
          />
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
      </div>

      {/* Collapsible conversation history drawer */}
      <div
        id="conversation-history-panel"
        data-testid="conversation-history-panel"
        hidden={!historyOpen || isGuest}
        className="max-h-60 overflow-y-auto border-b border-border-subtle bg-surface/60 px-6 py-4"
      >
        <div className="mx-auto max-w-4xl space-y-2">
          {conversations.length === 0 ? (
            <p className="py-2 text-xs text-text-muted">
              No saved conversations yet. Start a conversation below.
            </p>
          ) : (
            conversations.map((conv) => {
              const isSelected = conv.id === activeConversationId;
              return (
                <div
                  key={conv.id}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-md px-3 py-2 text-xs transition-colors',
                    isSelected
                      ? 'border border-border-strong bg-surface font-semibold text-text-primary'
                      : 'text-text-secondary hover:bg-surface hover:text-text-primary',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      selectConversation(conv.id);
                      setHistoryOpen(false);
                    }}
                    className="flex-1 truncate text-left"
                  >
                    {conv.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteConversation(conv.id)}
                    aria-label={`Delete conversation ${conv.title}`}
                    className="p-1 text-text-muted transition-colors hover:text-red-400"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        role="log"
        aria-label="Conversation messages"
        aria-live="polite"
        aria-relevant="additions"
        aria-atomic="false"
        aria-busy={isThinking}
        className="flex-1 overflow-y-auto px-6 py-8 space-y-12 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="max-w-4xl mx-auto pt-12 space-y-12 pb-24">
            <div className="space-y-4">
              <h1 className="type-page-title !text-[clamp(32px,5vw,40px)]">
                Say the vibe.
              </h1>
              <p className="text-text-secondary text-lg font-medium">
                A mood, an artist, a place, a time of day. MUSE answers with
                real songs, Nigeria first.
              </p>
            </div>

            {isAiNotConnected && <AiNotConnectedBanner />}

            {error && errorKind === 'human_check' && (
              <HumanCheckCard onVerified={retryLastMessage} />
            )}

            {error &&
              !isAiNotConnected &&
              errorKind &&
              errorKind !== 'ai_not_connected' &&
              errorKind !== 'human_check' && (
                <DistinctChatErrorBanner
                  kind={errorKind as BannerErrorKind}
                  message={error.message}
                  onRetry={retryLastMessage}
                />
              )}

            <VibeChips onPick={sendMessage} disabled={isThinking} />
            <TasteHint />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-12 pb-24">
            {messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))}

            {isThinking && !isAiNotConnected && (
              <div className="mr-auto">
                <ThinkingIndicator
                  stage={thinkingStage}
                  language={preferences.language}
                />
              </div>
            )}

            {isAiNotConnected && <AiNotConnectedBanner />}

            {error && errorKind === 'human_check' && (
              <HumanCheckCard onVerified={retryLastMessage} />
            )}

            {error &&
              !isAiNotConnected &&
              errorKind &&
              errorKind !== 'ai_not_connected' &&
              errorKind !== 'human_check' && (
                <DistinctChatErrorBanner
                  kind={errorKind as BannerErrorKind}
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
