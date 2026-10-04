/**
 * Word reveal math for assistant replies. Reveal words about 55ms apart with a
 * 400ms fade, and scale the chunk size so a long reply still finishes in about
 * 1.5 seconds instead of minutes.
 */

export interface WordRevealPlan {
  stepMs: number;
  fadeMs: number;
  /** How many words become visible per step. */
  chunk: number;
}

export const WORD_REVEAL_STEP_MS = 55;
export const WORD_REVEAL_FADE_MS = 400;
export const WORD_REVEAL_MAX_TOTAL_MS = 1500;

export function planWordReveal(
  wordCount: number,
  options: {
    stepMs?: number;
    fadeMs?: number;
    maxTotalMs?: number;
  } = {},
): WordRevealPlan {
  const stepMs = options.stepMs ?? WORD_REVEAL_STEP_MS;
  const fadeMs = options.fadeMs ?? WORD_REVEAL_FADE_MS;
  const maxTotalMs = options.maxTotalMs ?? WORD_REVEAL_MAX_TOTAL_MS;

  if (wordCount <= 0) {
    return { stepMs, fadeMs, chunk: 1 };
  }

  const maxSteps = Math.max(1, Math.floor(maxTotalMs / stepMs));
  return {
    stepMs,
    fadeMs,
    chunk: Math.max(1, Math.ceil(wordCount / maxSteps)),
  };
}

export interface WordRevealPart {
  token: string;
  isWord: boolean;
  wordIndex: number;
}

/** Splits text into words and whitespace so spacing stays selectable. */
export function tokenizeWords(text: string): WordRevealPart[] {
  const parts: WordRevealPart[] = [];
  let wordIndex = -1;

  for (const token of text.split(/(\s+)/)) {
    if (token.length === 0) continue;
    const isWord = !/^\s+$/.test(token);
    if (isWord) wordIndex += 1;
    parts.push({ token, isWord, wordIndex: isWord ? wordIndex : -1 });
  }

  return parts;
}

export function countWords(parts: WordRevealPart[]): number {
  return parts.reduce((total, part) => (part.isWord ? total + 1 : total), 0);
}
