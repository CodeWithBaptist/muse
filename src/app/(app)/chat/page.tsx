'use client';

import * as React from 'react';
import { useChat } from '@/hooks/use-chat';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { ThinkingIndicator } from '@/components/chat/ThinkingIndicator';
import { AlertCircle, Sparkles, Terminal } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';

const SUGGESTED_PROMPTS = [
  'Late night Afrobeats',
  'Something completely new',
  'Songs like Brent Faiyaz but less sad',
  'Music for a 2am drive',
  'Ambient study session',
  '90s Hip Hop deep cuts'
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

export default function ChatPage() {
  const { messages, sendMessage, isThinking, error, isAiNotConnected } = useChat();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking, error, isAiNotConnected]);

  return (
    <div className="h-full flex flex-col relative">
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-8 space-y-12 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="max-w-4xl mx-auto pt-12 space-y-12 pb-24">
            <div className="space-y-4">
              <h1 className="type-page-title !text-[clamp(32px,5vw,40px)]">What are we listening to?</h1>
              <p className="text-text-secondary text-lg font-medium">Tell me the mood, sound, artist, or moment.</p>
            </div>

            {isAiNotConnected && <AiNotConnectedBanner />}

            {error && !isAiNotConnected && (
              <Surface className="p-6 border-red-900/50 bg-red-950/10 flex items-start gap-4">
                <AlertCircle className="text-red-500 shrink-0 mt-1" size={20} />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-red-500 uppercase tracking-widest">Unable to send message</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{error.message}</p>
                </div>
              </Surface>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button 
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="p-6 text-left rounded-xl bg-surface border border-border-subtle hover:border-accent/50 hover:bg-surface/80 transition-all group"
                >
                  <div className="text-sm font-semibold text-text-secondary group-hover:text-text-primary transition-colors">{prompt}</div>
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
                <ThinkingIndicator />
              </div>
            )}

            {isAiNotConnected && <AiNotConnectedBanner />}

            {error && !isAiNotConnected && (
              <Surface className="p-6 border-red-900/50 bg-red-950/10 flex items-start gap-4">
                <AlertCircle className="text-red-500 shrink-0 mt-1" size={20} />
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-red-500 uppercase tracking-widest">Unable to send message</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{error.message}</p>
                </div>
              </Surface>
            )}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background/90 to-transparent">
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
