export const CHAT_UNAVAILABLE = "MUSE can't answer right now. Try again later.";
export const DISCOVER_UNAVAILABLE =
  'Discover is unavailable right now. Try again later.';

// Keep legacy error classification separate from the text rendered to visitors.
export function visitorMessage(
  value: unknown,
  fallback = CHAT_UNAVAILABLE,
): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  if (
    /\b[A-Z][A-Z0-9]*_(KEY|SECRET|URL|ID|TOKEN)\b/.test(value) ||
    /\b[A-Z][A-Z0-9_]*_(KEY|SECRET|URL|ID|TOKEN)\b/.test(value) ||
    /\.env(?:\.local)?|environment variables?|dashboard|vercel/i.test(value)
  )
    return fallback;
  return value;
}
