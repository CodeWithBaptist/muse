/**
 * Input sanitisation shared by every AI pipeline.
 *
 * These live in their own module so the recommendation engine and the
 * refinement module can both use them without importing each other. AI output
 * is untrusted, and so is user text: both pass through here before reaching a
 * prompt or a Spotify query.
 */

/**
 * Strips control characters, chat markup delimiters, and instruction override
 * attempts from user supplied text, then caps its length.
 */
export function sanitizeUserPromptText(input: string, maxLength = 800): string {
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .replace(/<\|im_start\|>|<\|im_end\|>|<\|endoftext\|>/gi, '')
    .replace(/<\/?(system|user_message|spotify_context|user_preferences|developer|assistant)>/gi, '')
    .replace(/\b(ignore\s+(all\s+)?(previous|prior|above)\s+instructions)\b/gi, '[filtered]')
    .trim()
    .slice(0, maxLength);
}

/**
 * Strips characters that could break out of a Spotify search query and caps the
 * length. Spotify search accepts field filters such as `genre:` and `year:`, so
 * the colon is deliberately preserved.
 */
export function sanitizeSpotifyQuery(query: string): string {
  return query
    .replace(/[\x00-\x1F\x7F<>`$\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}
