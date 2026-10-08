'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { fadeIn, transitions } from '@/lib/motion';
import { EqualizerBars } from '@/components/motion/EqualizerBars';

const DEFAULT_MESSAGES = [
  'Understanding your vibe',
  'Thinking through the sound',
  'Finding something that fits',
  'Building your list',
];

/** How long each contextual line stays on screen while the request runs. */
export const THINKING_MESSAGE_INTERVAL_MS = 1000;

export function getContextualLoadingMessages(prompt?: string): string[] {
  if (!prompt) return DEFAULT_MESSAGES;
  const normalized = prompt.toLowerCase();

  if (/playlist|mix|collection|setlist/.test(normalized)) {
    return [
      'Shaping your playlist concept',
      'Pulling songs that fit',
      'Sequencing tracks that flow together',
      'Building your list',
    ];
  }

  if (/like|similar|artist|band|sound of/.test(normalized)) {
    return [
      'Mapping artist sonic textures',
      'Pulling songs that fit',
      'Selecting standout cuts',
      'Writing track notes',
    ];
  }

  if (/why|history|who|what|explain|taste/.test(normalized)) {
    return [
      'Reading your question',
      'Thinking it through',
      'Composing response',
    ];
  }

  return DEFAULT_MESSAGES;
}

interface ThinkingIndicatorProps {
  /** Real stage reported by the streaming response, when one has arrived. */
  stage?: string | null;
  prompt?: string;
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
  intervalMs = THINKING_MESSAGE_INTERVAL_MS,
}: ThinkingIndicatorProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const messages = React.useMemo(
    () => getContextualLoadingMessages(prompt),
    [prompt],
  );
  const promptKey = prompt ?? '';
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
          current.key === promptKey
            ? (current.index + 1) % messages.length
            : 1,
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
        transition={
          shouldReduceMotion ? { duration: 0 } : transitions.standard
        }
        key={activeLabel}
        className="text-xs font-semibold uppercase tracking-widest text-text-muted"
      >
        {activeLabel}
      </motion.p>
    </div>
  );
}
