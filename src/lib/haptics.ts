/**
 * One short buzz for a confirmed tap, on phones that offer it. Chrome on
 * Android honours navigator.vibrate inside a user gesture; iOS Safari does
 * not expose it and simply gets nothing. Errors are swallowed.
 */
export function tapHaptic(): void {
  if (typeof navigator === 'undefined') return;
  const vibrate = (
    navigator as Navigator & { vibrate?: (pattern: number) => boolean }
  ).vibrate;
  if (typeof vibrate !== 'function') return;
  try {
    vibrate.call(navigator, 10);
  } catch {
    // Nothing to do: haptics are a courtesy.
  }
}
