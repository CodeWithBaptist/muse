'use client';

import * as React from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import {
  countWords,
  planWordReveal,
  tokenizeWords,
} from '@/lib/word-reveal';

interface WordRevealProps {
  text: string;
  className?: string;
}

/**
 * Reveals text word by word: about 55ms apart with a 400ms fade, in larger
 * chunks for long replies so the whole reveal stays near 1.5 seconds. The full
 * text is in the DOM the whole time, so it stays readable, selectable, and
 * available to assistive technology. Reduced motion shows it immediately.
 */
export function WordReveal({ text, className }: WordRevealProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const parts = React.useMemo(() => tokenizeWords(text), [text]);
  const wordCount = React.useMemo(() => countWords(parts), [parts]);
  const plan = React.useMemo(() => planWordReveal(wordCount), [wordCount]);
  const [revealedWords, setRevealedWords] = React.useState(0);
  // Reduced motion shows the whole reply with no reveal steps.
  const visibleWords = shouldReduceMotion ? wordCount : revealedWords;

  React.useEffect(() => {
    if (shouldReduceMotion) return;
    if (revealedWords >= wordCount) return;
    const timer = setTimeout(() => {
      setRevealedWords((current) => Math.min(current + plan.chunk, wordCount));
    }, plan.stepMs);
    return () => clearTimeout(timer);
  }, [
    plan.chunk,
    plan.stepMs,
    revealedWords,
    shouldReduceMotion,
    wordCount,
  ]);

  return (
    <span data-testid="word-reveal" className={className}>
      {parts.map((part, index) => {
        if (!part.isWord) return part.token;
        const revealed = shouldReduceMotion || part.wordIndex < visibleWords;
        return (
          <span
            key={`${index}-${part.token}`}
            data-testid="word-reveal-word"
            data-revealed={revealed ? 'true' : 'false'}
            className={cn(
              'transition-opacity',
              revealed ? 'opacity-100' : 'opacity-0',
            )}
            style={{
              transitionDuration: shouldReduceMotion
                ? '0ms'
                : `${plan.fadeMs}ms`,
            }}
          >
            {part.token}
          </span>
        );
      })}
    </span>
  );
}
