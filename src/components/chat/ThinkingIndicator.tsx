'use client';

import * as React from 'react';
import { motion } from 'motion/react';
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
  const messages = React.useMemo(
    () => getContextualLoadingMessages(prompt),
    [prompt]
  );
  const [msgIndex, setMsgIndex] = React.useState(0);

  React.useEffect(() => {
    if (stage) return;
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % messages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [stage, messages]);

  const activeLabel = stage || messages[msgIndex] || DEFAULT_MESSAGES[0];

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="thinking-indicator"
      className="flex flex-col gap-3 py-4"
    >
      <div className="flex items-center gap-1.5 h-4" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            animate={{ height: [4, 16, 4] }}
            transition={{
              repeat: Infinity,
              duration: 0.8,
              delay: i * 0.1,
              ease: 'easeInOut',
            }}
            className="w-1 bg-accent rounded-full"
          />
        ))}
      </div>
      <motion.p
        initial={fadeIn.initial}
        animate={fadeIn.animate}
        transition={transitions.standard}
        key={activeLabel}
        className="text-xs text-text-muted font-semibold uppercase tracking-widest"
      >
        {activeLabel}
      </motion.p>
    </div>
  );
}
