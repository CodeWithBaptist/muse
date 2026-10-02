'use client';

import { motion } from 'framer-motion';

const MESSAGES = [
  'Understanding your vibe',
  'Looking through your music',
  'Finding something that fits',
  'Building your mix'
];

export function ThinkingIndicator() {
  const [msgIndex, setMsgIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex items-center gap-1.5 h-4">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            animate={{ height: [4, 16, 4] }}
            transition={{
              repeat: Infinity,
              duration: 0.8,
              delay: i * 0.1,
              ease: "easeInOut"
            }}
            className="w-1 bg-accent rounded-full"
          />
        ))}
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        key={MESSAGES[msgIndex]}
        className="text-xs text-text-muted font-semibold uppercase tracking-widest"
      >
        {MESSAGES[msgIndex]}
      </motion.p>
    </div>
  );
}

import * as React from 'react';
