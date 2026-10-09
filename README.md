# MUSE

Tell MUSE the mood or the moment and it suggests eight to twelve real songs, Nigeria first, each with a one-line reason. Every pick is checked against Deezer and the Apple iTunes Search API and links out to Audiomack, Boomplay, Spotify, Apple Music, YouTube Music, and Deezer. No account is needed. Spotify sign-in exists for allow-listed testers only.

Stack: Next.js 16 (App Router), PostgreSQL with Drizzle ORM, Tailwind CSS 4, Motion, TanStack Query, Zod, OpenAI (`src/lib/ai/provider.ts`). Tests: Vitest, Testing Library, Playwright, axe-core.

## Run it locally

Node.js 22 (`.nvmrc`), npm, and PostgreSQL 16 (Docker for the bundled container, or your own server).

```bash
npm ci
cp .env.example .env.local   # fill in DATABASE_URL, OPENAI_API_KEY, ENCRYPTION_KEY
npm run db:up                # local PostgreSQL container
npm run db:push              # apply the Drizzle schema
npm run dev                  # http://127.0.0.1:3000
```

`npm run dev:stack` does the last three in one go. It only applies the schema to loopback databases; for a hosted database run `npm run db:push` yourself.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run verify` | typecheck, lint, and the Vitest suite |
| `npm run test` | Vitest unit and component tests |
| `npm run test:e2e` | Playwright browser suite (needs `npx playwright install chromium` once) |
| `npm run build` / `npm run start` | production build and server |
| `npm run db:up` / `db:down` / `db:push` | local PostgreSQL container and schema |
| `npm run format` / `format:check` | Prettier |

The Playwright suite mocks `/api` and uses sample data. It makes no real Spotify, OpenAI, or database requests. Browser tests, axe scans, and the throttled frame-rate check need a working Chromium, so run them outside the build sandbox before a release.

## Configuration

Names only; values live in `.env.local` locally and in the Vercel dashboard in production. `.env.example` documents each one.

Required:

* `DATABASE_URL`: PostgreSQL connection string (pooled for serverless).
* `OPENAI_API_KEY`: without it, chat and Discover show an explicit "AI is not connected" state.
* `ENCRYPTION_KEY`: 32 characters. Encrypts stored Spotify tokens and peppers the one-way hash of visitor IPs in rate-limit counters.
* `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`: tester sign-in only.

Optional:

* `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`: rate-limit and budget counters in Redis; without them the Postgres `rate_limits` table is used.
* `AI_MAX_OUTPUT_TOKENS`, `AI_DAILY_BUDGET_REQUESTS`, `AI_DAILY_BUDGET_TOKENS`: output cap and the shared daily budget (Lagos day) behind "MUSE is resting".
* `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`: Cloudflare Turnstile; the human check runs only when both are set.
* `SPOTIFY_TESTER_EMAILS` or `TESTER_KEY`: who sees Spotify sign-in and Create in Spotify. Neither set means it is hidden.
* `LASTFM_API_KEY`: the Last.fm import on the Profile page.
* `PAYMENTS_ENABLED`, `PAYSTACK_SECRET_KEY`: payments scaffold. Leave `PAYMENTS_ENABLED` unset.

Never put secrets in client code, browser storage, logs, screenshots, or source control.

## Display settings and performance

The Display menu stores two device-only choices under `muse.ui.prefs.v1`: theme (dark default, light available, both AA-checked in `src/lib/design-tokens.test.ts`) and Lite mode (auto, on, off). Everything decorative reads one effects level from `src/lib/ui-prefs.ts`: `none` under reduced motion, `lite` when Lite is on or auto detects Save-Data, a 2G class connection, or 2 GB of memory or less, else `full`. An inline script in `src/app/layout.tsx` stamps `data-theme` and `data-effects` on `<html>` before first paint.

Lighthouse does not run in the build sandbox. Before and after a release:

```bash
npx lighthouse https://<preview-url>/chat --form-factor=mobile --preset=perf --view
```

Functions stay in Vercel's default `iad1` region because the database is in US East. If the database moves to the EU, add `{ "regions": ["cdg1"] }` in `vercel.json` and keep Upstash in the same region.

## Payments (scaffold, off)

`/plus` shows the Free and Plus plans and says Plus is not open. `POST /api/billing/checkout` and `POST /api/billing/webhook` answer 503 `PAYMENTS_DISABLED` until `PAYMENTS_ENABLED=true`, and checkout refuses with `PRICE_NOT_SET` until a Plus price exists in `src/lib/billing/plans.ts`. Paystack's hosted page would take payment in naira; the webhook is verified with HMAC SHA-512 of the raw body. What has to happen before the flag flips is in `docs/PAYMENTS.md`.

## Legal pages

`/privacy`, `/terms`, and `/spotify-attribution` describe the no-account product: browser storage keys, what goes to OpenAI and the catalogues, hashed-IP counters, every cookie, Last.fm and export, NDPA 2023 rights, and a deletion path. They are drafts for a lawyer. Governing law, jurisdiction, and the database provider are marked as placeholders. Operator and contact are in `src/lib/legal.ts`.

## Spotify (testers only)

Register the exact callback URI in the Spotify Developer Dashboard. Spotify requires HTTPS except for loopback; use `127.0.0.1`, not `localhost`, for local HTTP ([redirect URI guidance](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)). Development Mode limits users per app and needs a Premium owner; check the app's quota mode against the [February 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) and the [July 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/july-2026) before testing.

MUSE is not represented as Spotify-policy compliant. Tester features send Spotify-derived listening data to OpenAI, and Spotify's [Developer Policy](https://developer.spotify.com/policy) restricts AI use of Spotify Content and requires deletion after disconnect. Get policy and legal review before opening the integration beyond testers. Passing mocked tests says nothing about Spotify API compatibility.

## Error monitoring

None is installed. The [Sentry Next.js SDK](https://docs.sentry.io/platforms/javascript/guides/nextjs/) is the obvious choice. Before enabling it, scrub request bodies and query data, skip Session Replay, and never send tokens, cookies, prompts, AI replies, listening history, or account details ([sensitive data scrubbing](https://docs.sentry.io/platforms/javascript/guides/nextjs/data-management/sensitive-data/)).

## Before a deploy

1. Apply schema changes to the intended database deliberately. Do not point local commands at production.
2. Check `/api/health`: 200 `{"ok":true}` when the database answers, 500 `{"ok":false}` otherwise, with no internal details.
3. Review `npm audit --omit=dev`. Upgrade and regression-test runtime dependencies before release; do not force upgrades without review.
4. For tester Spotify features, finish the policy, API mode, attribution, and deletion review first.
