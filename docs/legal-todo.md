# Legal review notes

The rendered pages no longer carry editorial review notices. This file preserves them; removing notices does not constitute legal approval.

## Removed notice

Draft for review

This draft was written from how MUSE works today, by reading the code that handles sign-in, storage, and the AI requests. It has not been reviewed by a lawyer and is not yet in force. Values in square brackets still have to be filled in.

## Before this is published: /privacy

'Fill in the database provider and confirm the hosting region.',
'Confirm the lawful bases and the cross-border transfer wording against the NDPA 2023 and the NDPC General Application and Implementation Directive, and check whether MUSE must register with the NDPC as a data controller of major importance.',
'Confirm the children wording (the NDPA treats anyone under 18 as a child and requires verifiable parental consent).',
'Check the OpenAI API data usage wording against the current policy before publishing.',
'Re-check the tester permissions list whenever src/lib/spotify.ts changes its scopes, and the storage keys whenever a store changes.',
'Add a payments section (Paystack as processor, what is stored, refunds) before PAYMENTS_ENABLED is turned on.',
'Verify every external link opens the intended page.',

## Before this is published: /terms

"Fill in the governing law and the jurisdiction (the operator is in Lagos; the Federal Republic of Nigeria and the courts of Lagos State are the obvious candidates, but this is the owner's and the lawyer's call).",
'Have the disclaimers and the limitation of liability checked against the Federal Competition and Consumer Protection Act 2018 and consumer law in any other launch country.',
'Confirm the minimum age wording with the Privacy Policy (NDPA 2023 treats anyone under 18 as a child).',
'Add payment terms (price, billing period, cancellation, refunds, VAT, Paystack as processor) before PAYMENTS_ENABLED is turned on.',
'Confirm the API terms of Deezer and Apple allow the attribution and the caching MUSE does, and that the search links to each service are acceptable to it.',
'Verify every external link opens the intended page.',

## Before this is published: /spotify-attribution

'Check the open-in link, tester sign-in, and Create in Spotify against the current Spotify Design and Branding Guidelines before launch; if logos are added, use the official files unmodified.',
'Check the Deezer API terms for the attribution they require and whether the chat line is enough; add the Deezer logo if they require it.',
'Check the Apple iTunes Search API terms for required attribution wording and linking.',
'Confirm with the Last.fm API terms that the "Last.fm" name is enough or whether a logo is required.',
'Verify every external link opens the intended page.',

## Remaining rendered placeholders

No values were guessed. The existing operator and contact in `src/lib/legal.ts` were retained.

| Page    | Placeholder                   | What the owner needs to supply                                                                                                     |
| ------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Privacy | [hosting provider and region] | Actual production host and configured processing region. The old Vercel / US East assertion is not established by this repository. |
| Privacy | [database provider]           | Actual managed database operator, or identify self-hosting.                                                                        |
| Privacy | [database region]             | Actual database region, including replicas and backups if applicable. Same-region hosting was not established by code.             |
| Terms   | [governing law]               | Owner and legal counsel must choose the applicable law.                                                                            |
| Terms   | [jurisdiction]                | Owner and legal counsel must choose the courts or dispute forum, respecting mandatory consumer protections.                        |

## Code audit, 13 October 2026

Claims corrected or qualified:

- Guest browser data is not exclusively on-device during use: messages, recent turns and compact taste data travel with requests. Guest chat is not saved as a database conversation. `guest-chat-store.ts` keeps 40 messages under `muse.chat.local.v1`.
- Display storage contains theme and Lite mode only, not the previously claimed sound preference.
- Confirmed other browser keys: `muse.chat.prefs.v1`, `muse.ui.prefs.v1`, and `muse.taste.v1`. Profile import controls currently require a tester session, although the taste endpoints can accept guests.
- The snapshot stores at most 20 artists, 20 top songs and 20 recent tracks, not 50 artists and songs. AI context can contain ten of each list plus artist play counts and date range (`taste/types.ts`, `ai/taste-context.ts`).
- Signed-in chat does not fetch Spotify listening history. Discover uses ten top artists and tracks; Profile additionally uses ten recent tracks and artist genres. Up to twelve explicit Memory notes can accompany signed-in AI requests.
- The claim that sensitive identity data is never sent to OpenAI was too broad: identity fields are not deliberately added, but messages and Memory notes can contain personal data supplied by the user.
- Rate-limit keys use SHA-256 of the proxy IP with an optional ENCRYPTION_KEY pepper, truncated to 24 base64url characters. Signed-in routes can key by user ID. These are pseudonymous identifiers, not a guarantee of anonymity. Raw addresses may occur in hosting logs.
- Counter windows are not deletion deadlines. Redis uses expiry; Postgres reuses expired rows and has no scheduled deletion in this code (`security/counter-store.ts`). Account deletion does not delete independent counters or hosting logs.
- Logs cannot be guaranteed free of secrets or personal data: several handlers log full error objects. Chat has a restricted error logger, but there is no project-wide redaction layer. Retention is deployment-dependent.
- Added missing `spotify_auth_next` cookie. Confirmed six application cookies: it, `spotify_auth_state`, `spotify_code_verifier` (ten minutes), `muse_human` (two hours), `muse_tester` and `muse_session` (30 days). Application cookies are HttpOnly, SameSite=Lax, Secure in production. Turnstile is an optional third-party script; a categorical no-third-party-script claim was not accurate.
- Output defaults to 1,200 tokens, configurable up to 4,096. Daily budget defaults are 1,500 reservations and 2,000,000 reported tokens with a Lagos-day reset. Zero disables a daily cap. Counter outages fail open, and tokens are counted after completion, so these are not hard cost guarantees. Chat and taste-insight route rate limits are 15 per minute, not the unused hourly/daily numbers in the plan scaffold.
- Catalogue checking applies to public playlist generation, not every AI utterance. Lists aim for eight to twelve songs and may be shorter. Direct catalogue links are used when available, not always search links. Artwork is not disabled by Lite mode.
- Catalogue providers can receive server lookup and browser artwork requests before any open-in link is tapped. Hosting locations and processor contract safeguards cannot be inferred from source code.
- Removed the unsupported operational promise of handling every request within 30 days. The owner must establish a lawful request-handling process and deadlines.
- Spotify appears in more than three features. Tester-only playback controls an external active Spotify device; MUSE does not stream audio. Discover uses Spotify results, but MUSE also retains recommendation and playlist records. No assertion of verified brand-policy compliance is made.
- Plus benefits are proposals, not live entitlements. `planForRequest()` always returns Free. No price is set and the checkout UI is closed. A checkout return or verified webhook does not activate Plus. Do not enable payments before implementing entitlements and payment terms.

Owner or counsel confirmation still needed:

- Actual production environment flags, hosting logs, retention, backups, processor regions and contracts. Repository inspection cannot verify deployed settings.
- OpenAI's current API data-use policy, all catalogue API terms, and external destination links. Outbound access in this environment did not permit checking these providers' policies or sites.
- Legal bases, cross-border safeguards, age/parental consent wording, consumer rights, ownership and jurisdiction. These are legal assertions or operator commitments, not behavior proven by code. No age or parental-consent verification is implemented.
- Spotify approval relies on the existing tester-gated OAuth callback before session creation. The UI uses that authenticated tester session, not a tester key alone, for playback.
