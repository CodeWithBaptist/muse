'use client';

import * as React from 'react';
import { Send, ArrowUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [value, setValue] = React.useState('');
  const textareaRef = React.useLayoutEffect(() => {
    // Auto-resize logic if needed
  }, [value]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (value.trim() && !disabled) {
      onSend(value.trim());
      setValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative group">
      <form onSubmit={handleSubmit} className="relative">
        <textarea
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Tell MUSE what you want to hear..."}
          disabled={disabled}
          className={cn(
            "w-full bg-surface border border-border-subtle rounded-xl py-4 pl-6 pr-14 text-sm text-text-primary placeholder:text-text-muted",
            "focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all resize-none overflow-hidden",
            "disabled:opacity-50"
          )}
          style={{ height: 'auto', minHeight: '56px' }}
        />
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          className={cn(
            "absolute right-3 bottom-3 w-8 h-8 rounded-lg flex items-center justify-center transition-all",
            value.trim() && !disabled 
              ? "bg-accent text-background scale-100" 
              : "bg-surface border border-border-strong text-text-muted scale-95"
          )}
        >
          <ArrowUp size={18} strokeWidth={2.5} />
        </button>
      </form>
      <div className="mt-3 flex justify-between px-2">
        <p className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">
          Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
