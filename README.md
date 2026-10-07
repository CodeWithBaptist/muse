# MUSE

MUSE is an AI music companion built on the Spotify Web API. It uses Next.js App Router, PostgreSQL, Drizzle ORM, Tailwind CSS, Motion, TanStack Query, Zod, and Claude.

## Technology

* **Framework:** Next.js 16 with the App Router
* **Database:** PostgreSQL with Drizzle ORM
* **Styling:** Tailwind CSS 4
* **Motion:** Motion for React
* **Data fetching:** TanStack Query
* **Validation:** Zod
* **AI providers:** Anthropic Claude (default) or Google Gemini, behind one interface in `src/lib/ai/provider.ts`. Vendor code lives in `src/lib/ai/providers/`. Anthropic defaults to `claude-sonnet-5-5` (`ANTHROPIC_MODEL` overrides); Gemini defaults to `gemini-flash-latest` (`GEMINI_MODEL` overrides). `AI_PROVIDER` forces a provider; otherwise MUSE picks whichever key is configured, preferring Anthropic.
* **Tests:** Vitest, Testing Library, Playwright, and axe-core

## Scripts

* `npm run dev`: start the local Next.js development server
* `npm run build`: create a production build
* `npm run start`: start the production server
* `npm run typecheck`: run TypeScript checks
* `npm run lint`: run ESLint
* `npm run test`: run the Vitest unit and component tests
* `npm run test:e2e`: run the Playwright browser suite
* `npm run test:e2e:list`: list the Playwright tests without launching a browser
* `npm run format`: format files with Prettier

## Local setup

1. Install the locked dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env.local` and provide local development credentials:

   ```bash
   cp .env.example .env.local
   ```

3. Point `DATABASE_URL` at a development database, then apply the Drizzle schema after reviewing the target database:

   ```bash
   npx drizzle-kit push
   ```

4. Start the application and open `http://127.0.0.1:3000`:

   ```bash
   npm run dev
   ```

## Browser and accessibility tests

Install the Playwright Chromium browser once for the local machine:

```bash
npx playwright install chromium
```

Run the browser flows with:

```bash
npm run test:e2e
```

The Playwright suite covers the mocked Spotify authorization redirect, signed-out route protection, chat responses and recommendations, playlist draft saving and export, primary navigation, mobile navigation and focus, reduced-motion preference, and recoverable errors. The axe test scans the landing page and the main authenticated routes for WCAG A and AA violations. The suite mocks `/api` responses and uses sample data. It does not make real Spotify, AI provider, or database requests, and it does not complete a real OAuth session or create a real playlist.

The Chromium performance test applies 2x CPU throttling through the Chrome DevTools Protocol and samples animation frame intervals during a chat response. It uses an average frame rate threshold of 58 fps and a 95th percentile frame interval threshold of 33.4 ms. This is a repeatable budget check, not a substitute for profiling on representative devices. Browser tests, axe scans, and throttled performance measurements must be run in an environment with a working Chromium installation before release.

## Accessibility and motion

The interface includes a skip link, a main landmark, visible keyboard focus, labeled controls, navigation state, status and error announcements, and reduced-motion handling. Verify keyboard operation and screen reader output manually in addition to automated axe checks. Automated checks do not certify accessibility conformance.

## Configuration

Set these environment variable names in `.env.local` for local development. Configure production values only through the project's approved secret-management process.

* `DATABASE_URL`: PostgreSQL connection string. Use a pooled connection for serverless deployments where appropriate.
* `SPOTIFY_CLIENT_ID`: Spotify application client ID.
* `SPOTIFY_CLIENT_SECRET`: Spotify application client secret.
* `SPOTIFY_REDIRECT_URI`: exact OAuth callback URI for the current environment.
* `AI_PROVIDER`: optional. `anthropic` or `gemini`. Leave unset to auto-detect from whichever key is configured (Anthropic wins when both are set).
* `ANTHROPIC_API_KEY`: Anthropic API key used for Claude chat, recommendations, Discover, and Profile Insights. A Claude Pro/Max subscription does not include API credits; the API is billed separately.
* `ANTHROPIC_MODEL`: optional Claude model override. Defaults to `claude-sonnet-5-5`; `claude-haiku-4-5` is a cheaper, faster option for high-volume classification.
* `GEMINI_API_KEY`: Google AI Studio API key, used instead of Anthropic when set and no Anthropic key is configured. `GOOGLE_API_KEY` is accepted as an alias. The free tier requires no credit card.
* `GEMINI_MODEL`: optional Gemini model override. Defaults to `gemini-flash-latest`; `gemini-2.5-flash` and `gemini-flash-lite-latest` are lighter free-tier alternatives.

When no provider key is set, or the value is a placeholder such as `add-later`, MUSE shows an explicit unavailable state for AI features rather than failing. Run `npm run check:ai` to verify the configured provider with one small live call.
* `ENCRYPTION_KEY`: 32-character key used to encrypt stored Spotify tokens.

Do not place secrets in client code, browser storage, screenshots, logs, or source control.

## Spotify application setup

Register the exact callback URI in the Spotify Developer Dashboard. Spotify requires HTTPS except for loopback addresses. For local HTTP development, use an explicit loopback IP such as `127.0.0.1`; `localhost` is not accepted. See Spotify's [redirect URI guidance](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri).

Development Mode requirements differ from Extended Quota Mode. Spotify's February 2026 guide says Development Mode app owners need an active Premium subscription and new apps may authorize up to five users. Existing apps above that user limit are grandfathered. The July 2026 update allows up to 25 Client IDs per developer account, while Development Mode API quotas are shared across that account. Extended Quota Mode apps are not affected by the February migration guide. Check the actual quota mode and current limits for the app before testing or release. See the [February 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) and [July 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/july-2026).

The Spotify app mode and MUSE's compatibility with the current API requirements have not been verified. Do not assume that passing mocked tests establishes Spotify API compatibility.

## Spotify policy and release review

MUSE is not represented as Spotify-policy compliant. The current product sends Spotify-derived listening data to Anthropic (Claude), or to Google Gemini when that provider is selected, and uses listening history for profile insights and recommendations. Spotify's [Developer Policy](https://developer.spotify.com/policy) restricts analyzing Spotify Content and using Spotify Platform or Content for AI ingestion, so these flows still need policy and legal review.

The disconnection deletion requirement is implemented: Spotify's policy requires deleting a user's personal data when they disconnect, and both the disconnect and account-deletion flows now call one shared routine (`deleteUserAccountData` in `src/lib/user-data.ts`) that removes every user-scoped row, including the Spotify identity fields on `users` (`spotify_id`, `display_name`, `email`, `avatar_url`). Because MUSE's only user identity is the Spotify account, disconnecting necessarily deletes the MUSE account and signs the user out; there is no state in which MUSE keeps an account without Spotify data. `src/lib/security/security.test.ts` asserts the deletion set so a future change cannot quietly reintroduce retention.

MUSE sends playback commands to Spotify and does not stream audio itself. Spotify's playback references include Premium requirements and restrictions concerning commercial streaming integrations. Whether the current or future product use falls within those restrictions remains unresolved. Obtain appropriate policy and legal review before release. The [Spotify attribution page](/spotify-attribution) is still a review placeholder and needs final branding, artwork, links, and attribution before release.

### Free-tier trade-off

The Gemini free tier is the zero-cost development path, but it is not a production configuration. Its quotas are rate limited, and Google states that free-tier prompts and responses may be used to improve its models. Given that MUSE already sends listening-derived data to its AI provider, that data-use term is a material difference from the paid Anthropic API and should be resolved before any real user traffic is routed through it.

## Error monitoring recommendation

Error monitoring is not installed or configured. A reasonable next step is the official [Sentry Next.js SDK](https://docs.sentry.io/platforms/javascript/guides/nextjs/) for App Router rendering errors, API route failures, and sampled performance traces. Keep the default rollout conservative and define an explicit data policy first.

Do not send Spotify access or refresh tokens, cookies, authorization headers, prompts, AI responses, Spotify listening history, or personal account details to monitoring. Disable or scrub request bodies and query data, add SDK-side redaction before events leave the app, and avoid Session Replay until its capture behavior has been reviewed. Sentry documents [sensitive data scrubbing](https://docs.sentry.io/platforms/javascript/guides/nextjs/data-management/sensitive-data/). Prefer route templates, status codes, provider error codes, durations, and non-identifying request IDs. Alert on sustained server errors, failed Spotify or AI requests, and health-check failures. Review retention, access controls, and processor terms before enabling a third-party monitor.

## Deployment checks

1. Review Spotify policy, API mode, endpoint compatibility, attribution, privacy, and data deletion before enabling the integration for real users.
2. Apply schema changes to the intended database through the project's deployment change process. Do not point local setup commands at production accidentally.
3. Deploy through the existing release process. No production configuration changes are made by the test suite.
4. Check database connectivity at `/api/health`. A healthy database returns HTTP 200 with `{"ok":true}`. An unavailable or unconfigured database returns HTTP 500 with `{"ok":false}` without returning credentials or internal error details.
5. Review `npm audit --omit=dev` findings. The current locked Next.js dependency has unresolved production advisories. Upgrade and regression-test the runtime dependencies before release. Do not apply forced dependency upgrades without review.
