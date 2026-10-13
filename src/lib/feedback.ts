import { LEGAL_CONTACT_EMAIL } from '@/lib/legal';

/**
 * One place for the feedback address and its prefilled subject, so the footer
 * and the chat use the same mailto link. No analytics, no tracking script,
 * and no form: the visitor's own mail app opens and they decide what to send.
 */

export const FEEDBACK_SUBJECT = 'MUSE feedback';

export function feedbackMailto(subject: string = FEEDBACK_SUBJECT): string {
  return `mailto:${LEGAL_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
