'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { fadeIn, transitions } from '@/lib/motion';
import { EqualizerBars } from '@/components/motion/EqualizerBars';
import type { ChatLanguage } from '@/lib/chat-preferences';

const DEFAULT_MESSAGES = [
  'Understanding your vibe',
  'Thinking through the sound',
  'Finding something that fits',
  'Building your list',
];

/**
 * The same four beats in Naija Pidgin, written the way people type, not a
 * caricature. Mix alternates English and Pidgin lines.
 */
const PIDGIN_MESSAGES = [
  'Dey feel your vibe...',
  'Make I check the sound...',
  'Dey cook your playlist...',
  'Small time, e dey come...',
];

const PIDGIN_PLAYLIST_MESSAGES = [
  'Dey arrange the playlist...',
  'Dey pick songs wey fit...',
  'Make I line them up well...',
  'Dey cook your playlist...',
];

const PIDGIN_ARTIST_MESSAGES = [
  'Dey check how the artist sound...',
  'Dey pick songs wey fit...',
  'Make I find the correct ones...',
  'Dey write small gist for each one...',
];

const PIDGIN_QUESTION_MESSAGES = [
  'Dey read your question...',
  'Make I reason am well...',
  'Small time, e dey come...',
];

function interleave(english: string[], pidgin: string[]): string[] {
  const length = Math.max(english.length, pidgin.length);
  const mixed: string[] = [];
  for (let index = 0; index < length; index += 1) {
    const line = index % 2 === 0 ? english[index] : pidgin[index];
    if (line) mixed.push(line);
  }
  return mixed;
}

/** How long each contextual line stays on screen while the request runs. */
export const THINKING_MESSAGE_INTERVAL_MS = 1000;

type PromptKind = 'playlist' | 'artist' | 'question' | 'default';

function promptKind(prompt?: string): PromptKind {
  if (!prompt) return 'default';
  const normalized = prompt.toLowerCase();
  if (/playlist|mix|collection|setlist/.test(normalized)) return 'playlist';
  if (/like|similar|artist|band|sound of/.test(normalized)) return 'artist';
  if (/why|history|who|what|explain|taste/.test(normalized)) return 'question';
  return 'default';
}

const ENGLISH_BY_KIND: Record<PromptKind, string[]> = {
  playlist: [
    'Shaping your playlist concept',
    'Pulling songs that fit',
    'Sequencing tracks that flow together',
    'Building your list',
  ],
  artist: [
    'Mapping artist sonic textures',
    'Pulling songs that fit',
    'Selecting standout cuts',
    'Writing track notes',
  ],
  question: [
    'Reading your question',
    'Thinking it through',
    'Composing response',
  ],
  default: DEFAULT_MESSAGES,
};

const PIDGIN_BY_KIND: Record<PromptKind, string[]> = {
  playlist: PIDGIN_PLAYLIST_MESSAGES,
  artist: PIDGIN_ARTIST_MESSAGES,
  question: PIDGIN_QUESTION_MESSAGES,
  default: PIDGIN_MESSAGES,
};

export function getContextualLoadingMessages(
  prompt?: string,
  language: ChatLanguage = 'english',
): string[] {
  const kind = promptKind(prompt);
  if (language === 'pidgin') return PIDGIN_BY_KIND[kind];
  if (language === 'mix')
    return interleave(ENGLISH_BY_KIND[kind], PIDGIN_BY_KIND[kind]);
  return ENGLISH_BY_KIND[kind];
}

interface ThinkingIndicatorProps {
  /** Real stage reported by the streaming response, when one has arrived. */
  stage?: string | null;
  prompt?: string;
  /** The language MUSE is speaking; the waiting lines follow it. */
  language?: ChatLanguage;
  intervalMs?: number;
}

/**
 * Thinking indicator for a request that is really running. The bars animate
 * only while this component is mounted, which only happens while a request is
 * in flight. When the AI is not connected the chat screen shows that state
 * instead of this indicator.
 */
export function ThinkingIndicator({
  stage,
  prompt,
  language = 'english',
  intervalMs = THINKING_MESSAGE_INTERVAL_MS,
}: ThinkingIndicatorProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const messages = React.useMemo(
    () => getContextualLoadingMessages(prompt, language),
    [language, prompt],
  );
  const promptKey = `${language}:${prompt ?? ''}`;
  const [rotation, setRotation] = React.useState({
    key: promptKey,
    index: 0,
  });

  const stageLabel = stage?.trim() ? stage.trim() : null;
  // A new prompt starts its own rotation from the first line.
  const messageIndex = rotation.key === promptKey ? rotation.index : 0;

  React.useEffect(() => {
    if (stageLabel || messages.length <= 1) return;
    const timer = setInterval(() => {
      setRotation((current) => ({
        key: promptKey,
        index:
          current.key === promptKey ? (current.index + 1) % messages.length : 1,
      }));
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, messages.length, promptKey, stageLabel]);

  const activeLabel =
    stageLabel ??
    messages[Math.min(messageIndex, messages.length - 1)] ??
    DEFAULT_MESSAGES[0];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="thinking-indicator"
      className="flex flex-col gap-3 py-4"
    >
      <EqualizerBars bars={4} tone="lime" height={16} width={3} />
      <motion.p
        initial={fadeIn.initial}
        animate={fadeIn.animate}
        transition={shouldReduceMotion ? { duration: 0 } : transitions.standard}
        key={activeLabel}
        className="text-xs font-semibold uppercase tracking-widest text-text-muted"
      >
        {activeLabel}
      </motion.p>
    </div>
  );
}
