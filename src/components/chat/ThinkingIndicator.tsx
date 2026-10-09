'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { fadeIn, transitions } from '@/lib/motion';
import { EqualizerBars } from '@/components/motion/EqualizerBars';
import type { ChatLanguage } from '@/lib/chat-preferences';

/** What the indicator says before the server reports a real stage. */
export const WAITING_LINE: Record<ChatLanguage, string> = {
  english: 'Finding tracks',
  pidgin: 'Dey find the tracks',
  mix: 'Finding tracks',
};

interface ThinkingIndicatorProps {
  /** Stage reported by the streaming response, once one has arrived. */
  stage?: string | null;
  /** The language MUSE is speaking; the waiting line follows it. */
  language?: ChatLanguage;
}

/**
 * Shown only while a request is really running, so the bars always mean
 * something. The server's stage line wins as soon as it arrives.
 */
export function ThinkingIndicator({
  stage,
  language = 'english',
}: ThinkingIndicatorProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const label = stage?.trim() || WAITING_LINE[language];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="thinking-indicator"
      className="flex flex-col gap-3 py-4"
    >
      <EqualizerBars bars={4} tone="accent" height={16} width={3} />
      <motion.p
        initial={fadeIn.initial}
        animate={fadeIn.animate}
        transition={shouldReduceMotion ? { duration: 0 } : transitions.standard}
        key={label}
        className="text-xs font-semibold uppercase tracking-widest text-text-muted"
      >
        {label}
      </motion.p>
    </div>
  );
}
