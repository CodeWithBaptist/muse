import type { PlanId } from './plans';

/**
 * Who is on which plan. Today the answer is always Free: the scaffold has no
 * place to record a paid plan yet, and no paid feature is switched on.
 *
 * TODO(billing): when payments open, give a paid visitor an identity that
 * is not Spotify (an email the checkout already collects, confirmed by a
 * magic link), store the plan against it with the Paystack reference and
 * the period end, and read it here from a signed HttpOnly cookie. Then the
 * limits in plans.ts can replace the fixed numbers in the chat and taste
 * routes. Until then this stays a pure function so nothing can half-work.
 */
export function planForRequest(): PlanId {
  return 'free';
}
