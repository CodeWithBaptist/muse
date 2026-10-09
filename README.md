# MUSE

MUSE is an AI music companion built on the Spotify Web API. It uses Next.js App Router, PostgreSQL, Drizzle ORM, Tailwind CSS, Motion, TanStack Query, Zod, and OpenAI.

## Technology

* **Framework:** Next.js 16 with the App Router
* **Database:** PostgreSQL with Drizzle ORM
* **Styling:** Tailwind CSS 4
* **Motion:** Motion for React
* **Data fetching:** TanStack Query
* **Validation:** Zod
* **AI provider:** OpenAI, configured in `src/lib/ai/provider.ts`
* **Tests:** Vitest, Testing Library, Playwright, and axe-core

## Scripts

* `npm run dev`: start the local Next.js development server
* `npm run dev:stack`: start the local PostgreSQL container, apply the schema, and start Next.js in one command
* `npm run db:up`: start the local PostgreSQL container from `docker-compose.yml`
* `npm run db:down`: stop the local PostgreSQL container (data is kept in a named volume)
* `npm run db:push`: apply the Drizzle schema to the database in `DATABASE_URL`
* `npm run verify`: run TypeScript checks, ESLint, and the Vitest suite in one pass
* `npm run format:check`: report Prettier formatting differences without writing files
* `npm run build`: create a production build
* `npm run start`: start the production server
* `npm run typecheck`: run TypeScript checks
* `npm run lint`: run ESLint
* `npm run test`: run the Vitest unit and component tests
* `npm run test:e2e`: run the Playwright browser suite
* `npm run test:e2e:list`: list the Playwright tests without launching a browser
* `npm run format`: format files with Prettier

## Local setup

You need Node.js 22 (see `.nvmrc`), npm, and either Docker (for the bundled PostgreSQL container) or your own PostgreSQL 16 server.

1. Install the locked dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env.local` and provide local development credentials:

   ```bash
   cp .env.example .env.local
   ```

   The example `DATABASE_URL` already points at the local Docker database (`postgresql://muse:muse@127.0.0.1:5432/muse`). If port 5432 is taken, set `MUSE_DB_PORT` to another port and change the port in `DATABASE_URL` to match. To use a hosted database instead, replace `DATABASE_URL` with its connection string.

3. Start PostgreSQL and apply the Drizzle schema:

   ```bash
   npm run db:up
   npm run db:push
   ```

   Or do everything in one command. `npm run dev:stack` starts the container when Docker is available, waits for PostgreSQL, applies the schema, and then starts Next.js. It only applies the schema automatically to loopback databases (`127.0.0.1`, `localhost`); for a hosted database it skips that step so you can review the target first and run `npm run db:push` deliberately.

   ```bash
   npm run dev:stack
   ```

4. If you did not use `npm run dev:stack`, start the application and open `http://127.0.0.1:3000`:

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

The Playwright suite covers the mocked Spotify authorization redirect, signed-out route protection, chat responses and recommendations, playlist draft saving and export, primary navigation, mobile navigation and focus, reduced-motion preference, and recoverable errors. The axe test scans the landing page and the main authenticated routes for WCAG A and AA violations. The suite mocks `/api` responses and uses sample data. It does not make real Spotify, OpenAI, or database requests, and it does not complete a real OAuth session or create a real playlist.

The Chromium performance test applies 2x CPU throttling through the Chrome DevTools Protocol and samples animation frame intervals during a chat response. It uses an average frame rate threshold of 58 fps and a 95th percentile frame interval threshold of 33.4 ms. This is a repeatable budget check, not a substitute for profiling on representative devices. Browser tests, axe scans, and throttled performance measurements must be run in an environment with a working Chromium installation before release.

## Accessibility and motion

The interface includes a skip link, a main landmark, visible keyboard focus, labeled controls, navigation state, status and error announcements, and reduced-motion handling. Verify keyboard operation and screen reader output manually in addition to automated axe checks. Automated checks do not certify accessibility conformance.

### Display settings, Lite mode, and the effects level

The Display menu (sidebar, phone header, landing header) holds three device-only choices stored under `muse.ui.prefs.v1`: theme (dark by default, light available, both AA-checked in `src/lib/design-tokens.test.ts`), Lite mode (auto, on, off), and sound (off by default, Web Audio blips only). Every decorative effect reads one effects level from `src/lib/ui-prefs.ts`:

* `none`: the system asks for reduced motion. Nothing decorative moves.
* `lite`: Lite is on, or auto and the browser reports Save-Data, a 2G class connection, or two gigabytes of memory or less. The living background and the notes burst render nothing, the landing canvases paint a still frame, typed reveals are instant, ripples and pointer tilts are skipped.
* `full`: everything, on `transform` and `opacity` only.

A small inline script in `src/app/layout.tsx` stamps `data-theme` and `data-effects` on `<html>` before the first paint, so there is no flash and CSS rules such as `html[data-effects="lite"] .muse-effect-full` apply immediately.

### Performance checks for phones

Lighthouse cannot run in the build sandbox. Before and after a release, run it against the preview on a mobile profile, once with the defaults and once after choosing Lite in the Display menu:

```bash
npx lighthouse https://<preview-url>/chat --form-factor=mobile --preset=perf --view
```

The Vercel functions stay in the default `iad1` region because the database is in the US East region; moving only the functions nearer West Africa would put every database round trip across the Atlantic. Static assets are served from Vercel's CDN regardless. If the database moves to the EU, add `{ "regions": ["cdg1"] }` in `vercel.json` at the same time, and keep the Upstash database in the same region as the functions.

## Configuration

Set these environment variable names in `.env.local` for local development. Configure production values only through the project's approved secret-management process.

* `DATABASE_URL`: PostgreSQL connection string. Use a pooled connection for serverless deployments where appropriate.
* `SPOTIFY_CLIENT_ID`: Spotify application client ID.
* `SPOTIFY_CLIENT_SECRET`: Spotify application client secret.
* `SPOTIFY_REDIRECT_URI`: exact OAuth callback URI for the current environment.
* `OPENAI_API_KEY`: OpenAI API key. When this is absent, MUSE shows an explicit unavailable state for AI features.
* `ENCRYPTION_KEY`: 32-character key used to encrypt stored Spotify tokens.

Do not place secrets in client code, browser storage, screenshots, logs, or source control.

## Spotify application setup

Register the exact callback URI in the Spotify Developer Dashboard. Spotify requires HTTPS except for loopback addresses. For local HTTP development, use an explicit loopback IP such as `127.0.0.1`; `localhost` is not accepted. See Spotify's [redirect URI guidance](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri).

Development Mode requirements differ from Extended Quota Mode. Spotify's February 2026 guide says Development Mode app owners need an active Premium subscription and new apps may authorize up to five users. Existing apps above that user limit are grandfathered. The July 2026 update allows up to 25 Client IDs per developer account, while Development Mode API quotas are shared across that account. Extended Quota Mode apps are not affected by the February migration guide. Check the actual quota mode and current limits for the app before testing or release. See the [February 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) and [July 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/july-2026).

The Spotify app mode and MUSE's compatibility with the current API requirements have not been verified. Do not assume that passing mocked tests establishes Spotify API compatibility.

## Spotify policy and release review

MUSE is not represented as Spotify-policy compliant. The current product sends Spotify-derived listening data to OpenAI and uses listening history for profile insights and recommendations. Spotify's [Developer Policy](https://developer.spotify.com/policy) restricts analyzing Spotify Content and using Spotify Platform or Content for AI ingestion. It also requires deletion and no further processing of a user's personal data after disconnection. MUSE currently retains Spotify account identity fields after disconnect, so the deletion flow needs review and remediation before the integration can be treated as compliant.

MUSE sends playback commands to Spotify and does not stream audio itself. Spotify's playback references include Premium requirements and restrictions concerning commercial streaming integrations. Whether the current or future product use falls within those restrictions remains unresolved. Obtain appropriate policy and legal review before release. The [Spotify attribution page](/spotify-attribution) is still a review placeholder and needs final branding, artwork, links, and attribution before release.

## Error monitoring recommendation

Error monitoring is not installed or configured. A reasonable next step is the official [Sentry Next.js SDK](https://docs.sentry.io/platforms/javascript/guides/nextjs/) for App Router rendering errors, API route failures, and sampled performance traces. Keep the default rollout conservative and define an explicit data policy first.

Do not send Spotify access or refresh tokens, cookies, authorization headers, prompts, AI responses, Spotify listening history, or personal account details to monitoring. Disable or scrub request bodies and query data, add SDK-side redaction before events leave the app, and avoid Session Replay until its capture behavior has been reviewed. Sentry documents [sensitive data scrubbing](https://docs.sentry.io/platforms/javascript/guides/nextjs/data-management/sensitive-data/). Prefer route templates, status codes, provider error codes, durations, and non-identifying request IDs. Alert on sustained server errors, failed Spotify or AI requests, and health-check failures. Review retention, access controls, and processor terms before enabling a third-party monitor.

## Deployment checks

1. Review Spotify policy, API mode, endpoint compatibility, attribution, privacy, and data deletion before enabling the integration for real users.
2. Apply schema changes to the intended database through the project's deployment change process. Do not point local setup commands at production accidentally.
3. Deploy through the existing release process. No production configuration changes are made by the test suite.
4. Check database connectivity at `/api/health`. A healthy database returns HTTP 200 with `{"ok":true}`. An unavailable or unconfigured database returns HTTP 500 with `{"ok":false}` without returning credentials or internal error details.
5. Review `npm audit --omit=dev` findings. The current locked Next.js dependency has unresolved production advisories. Upgrade and regression-test the runtime dependencies before release. Do not apply forced dependency upgrades without review.
