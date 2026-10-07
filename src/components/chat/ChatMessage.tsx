'use client';

import * as React from 'react';
import { motion } from 'motion/react';
import { Logo } from '@/components/ui/Logo';
import { WordReveal } from './WordReveal';
import { fadeIn, fadeInUp, transitions } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * One turn of conversation text.
 *
 * Recommended tracks are deliberately not rendered here. The list lives in
 * SelectionPanel, which persists across turns so a refinement can keep the rows
 * that still fit in place. Rendering rows inside a message would give every
 * turn its own list, and rows would re-enter from nothing each time instead of
 * staying where they were.
 */

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
}

export function ChatMessage({ message }: { message: Message }) {
  const isAssistant = message.role === 'assistant';

  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      transition={transitions.standard}
      className={cn(
        'flex flex-col gap-4 max-w-3xl',
        isAssistant ? 'mr-auto' : 'ml-auto text-right'
      )}
    >
      {isAssistant && (
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-sm bg-surface border border-border-subtle flex items-center justify-center overflow-hidden">
            <Logo variant="mark" size={14} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            MUSE
          </span>
        </div>
      )}

      <motion.div
        variants={fadeIn}
        initial="initial"
        animate="animate"
        transition={transitions.standard}
        className={cn(
          'p-4 text-sm leading-relaxed font-medium',
          isAssistant
            ? 'bg-transparent text-text-primary border-l border-border-strong pl-6'
            : 'bg-accent/5 text-text-primary rounded-2xl rounded-tr-none border border-accent/10 px-6'
        )}
      >
        {isAssistant ? (
          <WordReveal text={message.content} />
        ) : (
          <span>{message.content}</span>
        )}
      </motion.div>
    </motion.div>
  );
}
