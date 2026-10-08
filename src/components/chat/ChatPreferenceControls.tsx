'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  CHAT_LANGUAGES,
  CHAT_LANGUAGE_LABELS,
  MUSIC_SCOPES,
  MUSIC_SCOPE_LABELS,
  type ChatPreferences,
} from '@/lib/chat-preferences';

/**
 * Two small segmented controls for the chat header: where the music leans
 * and what language MUSE speaks. Each is a labelled group of toggle buttons
 * (aria-pressed), so screen readers hear the group name, the option, and
 * its state, and every target is at least 32px tall with the focus ring.
 */

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (next: T) => void;
  testId: string;
}

function Segmented<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
  testId,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      data-testid={testId}
      className="inline-flex h-8 items-stretch rounded-md border border-border-subtle bg-background p-0.5"
    >
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={cn(
              'min-w-[3.25rem] rounded-[5px] px-2.5 text-xs font-semibold transition-colors focus-ring',
              active
                ? 'bg-surface text-text-primary'
                : 'text-text-muted hover:text-text-secondary',
            )}
          >
            {labels[option]}
          </button>
        );
      })}
    </div>
  );
}

export interface ChatPreferenceControlsProps {
  preferences: ChatPreferences;
  onChange: (next: Partial<ChatPreferences>) => void;
  className?: string;
}

export function ChatPreferenceControls({
  preferences,
  onChange,
  className,
}: ChatPreferenceControlsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Segmented
        label="Music scope"
        testId="chat-scope-control"
        value={preferences.scope}
        options={MUSIC_SCOPES}
        labels={MUSIC_SCOPE_LABELS}
        onChange={(scope) => onChange({ scope })}
      />
      <Segmented
        label="Language"
        testId="chat-language-control"
        value={preferences.language}
        options={CHAT_LANGUAGES}
        labels={CHAT_LANGUAGE_LABELS}
        onChange={(language) => onChange({ language })}
      />
    </div>
  );
}
