# Payments scaffold (Paystack, NGN)

Status: **scaffold, switched off**. `PAYMENTS_ENABLED` is not `true` anywhere, no key is set, nothing is charged, and the `/plus` page says so. This document is the list of what exists, what must happen before the flag flips, and what is deliberately not built yet.

## What exists

| Piece | Where | Behaviour while off |
| --- | --- | --- |
| Plan table (Free, Plus) | `src/lib/billing/plans.ts` | Served by `GET /api/billing/status`; Plus has no price (`null`) |
| Flag and key reading | `src/lib/billing/config.ts` | `paymentsEnabled()` false, `billingStatus()` never includes keys |
| Paystack client | `src/lib/billing/paystack.ts` | Never called |
| Checkout | `POST /api/billing/checkout` | 503 `PAYMENTS_DISABLED` before the body is read |
| Webhook | `POST /api/billing/webhook` | 503 `PAYMENTS_DISABLED`; when on, HMAC SHA-512 of the raw body must match `x-paystack-signature` or 401 |
| Plans page | `/plus` (open, no account) | Plan table plus "Plus is not open yet. Nothing is charged." No form |
| Entitlements | `src/lib/billing/entitlements.ts` | Always `free` |

Free is today's MUSE. Plus benefits are longer lists (20), more hourly room (60), unlimited "Your taste in words", and being served while the shared daily budget rests. None of them touch Spotify, and `paystack.test.ts` fails if the word appears in the Plus plan.

## Flow when it opens

1. The visitor enters an email on `/plus` and MUSE calls `POST /api/billing/checkout` (same-origin check, 5 per minute per IP).
2. The server calls Paystack `transaction/initialize` with the amount in kobo, a `muse_` reference, and `callback_url = /plus?returned=1`, then returns the hosted `authorization_url`. Card details never touch MUSE.
3. The visitor pays on Paystack and returns to `/plus?returned=1`, which only says the payment is being confirmed.
4. Paystack posts `charge.success` to `POST /api/billing/webhook`. After the signature check the handler must call `verifyTransaction(reference)` and only then record the plan.

## Before `PAYMENTS_ENABLED=true`

Registrations and keys (owner):

- A Paystack business account for the operator, with KYC completed (for a Nigerian business: CAC registration documents or the starter business path, BVN of a director, a settlement bank account in naira). Live keys are issued only after Paystack approves the business.
- Test keys first: `sk_test_...` in `PAYSTACK_SECRET_KEY` on the Vercel preview. Switch to `sk_live_...` only on production, only after a full test run.
- Register the webhook URL in the Paystack dashboard: `https://<domain>/api/billing/webhook` (test and live are separate settings).
- Decide the Plus price in naira and set `PLANS.plus.priceNgnMonthly`; until it is set, checkout answers 503 `PRICE_NOT_SET` even with the flag on.
- Decide whether Plus is a one-off month or a Paystack subscription plan (`PAYSTACK_PLUS_PLAN_CODE` would be added then). Subscriptions need card tokenisation terms in the Terms page.
- Terms and Privacy must gain a payments section: Paystack as processor, what is stored (email, reference, plan, period), refunds, cancellation, VAT if applicable. Lawyer review.

Code TODOs (marked `TODO(billing)` in the source):

- `entitlements.ts`: give a paid visitor an identity that is not Spotify (email confirmed by a magic link), store plan, reference, and period end, read from a signed HttpOnly cookie.
- `webhook/route.ts`: verify the reference with Paystack, record the plan, handle `subscription.disable` and `invoice.payment_failed`, stay idempotent (Paystack retries until it sees 200).
- Chat and taste routes: read the plan's limits instead of the fixed numbers (`songsPerList`, `requestsPerHour`, `tasteProfilesPerDay`, `servedWhileResting`).
- A "manage" view: current plan, period end, cancel, receipt list, data deletion for billing records.
- Error monitoring on checkout and webhook failures (no emails or amounts in events).

## What is deliberately not built

- No database table yet: schema changes wait for the identity decision above, so nothing can half-work.
- No inline Paystack popup and no public key: the hosted page needs only the secret key on the server.
- No Flutterwave: Paystack was the owner's choice on 2026-10-09.
