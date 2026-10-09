/**
 * The vibe the page is currently dressed for: the last prompt the visitor
 * sent, or nothing. A tiny external store so the backdrop can follow the
 * chat without the chat knowing the backdrop exists. Not persisted.
 */

type Listener = () => void;

let current: string | null = null;
const listeners = new Set<Listener>();

export function getVibe(): string | null {
  return current;
}

export function setVibe(next: string | null): void {
  const value = next?.trim() ? next.trim() : null;
  if (value === current) return;
  current = value;
  for (const listener of listeners) listener();
}

export function subscribeVibe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
