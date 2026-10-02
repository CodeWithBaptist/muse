'use client';

import * as React from 'react';
import { useChat } from '@/hooks/use-chat';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { ThinkingIndicator } from '@/components/chat/ThinkingIndicator';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Terminal } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';

const SUGGESTED_PROMPTS = [
  'Late night Afrobeats',
  'Something completely new',
  'Songs like Brent Faiyaz but less sad',
  'Music for a 2am drive',
  'Ambient study session',
  '90s Hip Hop deep cuts'
];

export default function ChatPage() {
  const { messages, sendMessage, isThinking, error } = useChat();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  return (
    <div className="h-full flex flex-col relative">
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-8 space-y-12 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="max-w-4xl mx-auto pt-12 space-y-12">
            <div className="space-y-4">
              <h1 className="type-page-title !text-[clamp(32px,5vw,40px)]">What are we listening to?</h1>
              <p className="text-text-secondary text-lg font-medium">Tell me the mood, sound, artist, or moment.</p>
            </div>
            
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

            {error && (
              <Surface className="p-6 border-red-900/50 bg-red-950/10 flex items-start gap-4">
                <AlertCircle className="text-red-500 shrink-0 mt-1" size={20} />
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-red-500 uppercase tracking-widest">Configuration Required</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {error.message.includes('OPENAI_API_KEY') 
                      ? "MUSE needs an OpenAI API key to process your requests. Please add OPENAI_API_KEY to your environment variables." 
                      : error.message}
                  </p>
                  <div className="flex items-center gap-2 pt-2 text-[10px] text-text-muted font-mono">
                    <Terminal size={12} />
                    <span>REFER TO .ENV.EXAMPLE</span>
                  </div>
                </div>
              </Surface>
            )}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background/90 to-transparent">
        <div className="max-w-4xl mx-auto">
          <ChatInput onSend={sendMessage} disabled={isThinking} />
        </div>
      </div>
    </div>
  );
}

