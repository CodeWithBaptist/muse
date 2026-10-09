'use client';

import * as React from 'react';
import { ArrowUp } from 'lucide-react';
import { playSound } from '@/lib/ui-sound';
import { cn } from '@/lib/utils';
import { CHAT_MESSAGE_MAX_LENGTH } from '@/lib/validation/api-schemas';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [value, setValue] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = '56px';
    const nextHeight = Math.max(56, Math.min(textarea.scrollHeight, 200));
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > 200 ? 'auto' : 'hidden';
  }, [value]);

  const handleSubmit = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (value.trim() && !disabled) {
      playSound('tap');
      onSend(value.trim());
      setValue('');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="group relative">
      <form
        aria-label="Send a message to MUSE"
        onSubmit={handleSubmit}
        className="relative"
      >
        <textarea
          ref={textareaRef}
          id="chat-message-input"
          aria-label="Message MUSE"
          aria-describedby="chat-input-hint"
          rows={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Tell MUSE what you want to hear...'}
          disabled={disabled}
          maxLength={CHAT_MESSAGE_MAX_LENGTH}
          className={cn(
            'w-full resize-none overflow-hidden rounded-xl border border-border-subtle bg-surface py-4 pl-6 pr-14 text-sm text-text-primary placeholder:text-text-muted',
            'transition-colors focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/20',
            'disabled:opacity-50',
          )}
          style={{ height: '56px', minHeight: '56px', maxHeight: '200px' }}
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={!value.trim() || disabled}
          className={cn(
            'absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed',
            value.trim() && !disabled
              ? 'bg-accent text-background'
              : 'border border-border-strong bg-surface text-text-muted',
          )}
        >
          <ArrowUp size={18} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </form>
      <p
        id="chat-input-hint"
        className="mt-3 flex justify-between gap-4 px-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted"
      >
        <span>Enter to send. Shift and Enter for a new line.</span>
        {value.length >= CHAT_MESSAGE_MAX_LENGTH - 100 ? (
          <span aria-live="polite" data-chat-input-count>
            {value.length}/{CHAT_MESSAGE_MAX_LENGTH}
          </span>
        ) : null}
      </p>
    </div>
  );
}
