'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { fadeIn, transitions } from '@/lib/motion';

const DEFAULT_MESSAGES = [
  'Understanding your vibe',
  'Looking through your music',
  'Finding something that fits',
  'Building your mix',
];

export function getContextualLoadingMessages(prompt?: string): string[] {
  if (!prompt) return DEFAULT_MESSAGES;
  const normalized = prompt.toLowerCase();

  if (/playlist|mix|collection|setlist/.test(normalized)) {
    return [
      'Shaping your playlist concept',
      'Searching Spotify catalog',
      'Sequencing tracks that flow together',
      'Building your mix',
    ];
  }

  if (/like|similar|artist|band|sound of/.test(normalized)) {
    return [
      'Mapping artist sonic textures',
      'Searching Spotify catalog',
      'Selecting standout cuts',
      'Writing track notes',
    ];
  }

  if (/why|history|who|what|explain|taste/.test(normalized)) {
    return [
      'Reading your question',
      'Checking your listening context',
      'Composing response',
    ];
  }

  return DEFAULT_MESSAGES;
}

interface ThinkingIndicatorProps {
  stage?: string | null;
  prompt?: string;
}

export function ThinkingIndicator({ stage, prompt }: ThinkingIndicatorProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const messages = React.useMemo(
    () => getContextualLoadingMessages(prompt),
    [prompt],
  );
  const activeLabel = stage || messages[0] || DEFAULT_MESSAGES[0];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="thinking-indicator"
      className="flex flex-col gap-3 py-4"
    >
      <div className="flex h-4 items-center gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <motion.span
            key={index}
            animate={
              shouldReduceMotion ? { scaleY: 1 } : { scaleY: [0.3, 1, 0.4] }
            }
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : {
                    repeat: Infinity,
                    duration: 0.8,
                    delay: index * 0.1,
                    ease: 'easeInOut',
                  }
            }
            className="h-4 w-1 origin-bottom rounded-full bg-accent"
          />
        ))}
      </div>
      <motion.p
        initial={shouldReduceMotion ? false : fadeIn.initial}
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
