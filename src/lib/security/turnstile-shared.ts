/**
 * Turnstile values that the browser widget and the server share. Kept apart
 * from turnstile.ts, which pulls in the counter store and therefore the
 * database driver, so client bundles never import server code.
 */
export const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js';

export const HUMAN_CHECK_REQUIRED_CODE = 'HUMAN_CHECK_REQUIRED' as const;
export const HUMAN_CHECK_REQUIRED_MESSAGE =
  'Please confirm you are human to continue.';
export const HUMAN_CHECK_FAILED_CODE = 'HUMAN_CHECK_FAILED' as const;
export const HUMAN_CHECK_FAILED_MESSAGE =
  'Could not confirm you are human. Please try again.';
