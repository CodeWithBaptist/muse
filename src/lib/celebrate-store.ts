/**
 * A one-shot "a playlist just arrived" flag. The chat hook raises it when a
 * reply with songs lands; the first list that mounts within a few seconds
 * claims it and plays the burst. Lists restored from history find nothing
 * to claim, so reopening a chat stays quiet.
 */

const FRESH_MS = 4000;

let pending: { id: number; at: number } | null = null;
let nextId = 1;

export function celebrate(now: number = Date.now()): void {
  pending = { id: nextId++, at: now };
}

/** True once per celebration, and only while it is fresh. */
export function claimCelebration(now: number = Date.now()): boolean {
  if (!pending) return false;
  const fresh = now - pending.at <= FRESH_MS;
  pending = null;
  return fresh;
}

/** Test helper. */
export function resetCelebration(): void {
  pending = null;
}
