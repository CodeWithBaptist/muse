# MUSE decision log

Meaningful architectural and product decisions, newest first. Each entry records the decision, why it was made, the alternatives considered, the impact, and the date. Add an entry before making a change that would be expensive to reverse.

---

## 2026-10-07: The landing decides "Connect Spotify" availability on the server

**Decision**
The landing page reads the Spotify sign-in configuration on the server for every request (`isSpotifyLoginConfigured()` in `src/lib/spotify-config.ts`, which needs `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, and a usable `ENCRYPTION_KEY`) and passes the result to the header, hero, and closing band. When sign-in cannot complete, the primary action renders disabled with a visible explanation. The auth start route redirects browser navigations back to `/?error=auth_not_configured` and keeps the JSON 503 for programmatic callers, and the landing now explains every `?error=` code the auth routes redirect with.

**Why**
Before this, the button navigated to a raw JSON 503 page whenever credentials were missing, and failed sign-ins landed on the homepage with no message. The page is already `force-dynamic`, so a server-side read costs nothing, needs no extra request, and never flashes between states.

**Alternatives considered**

- Expose a `spotifyConfigured` flag on `/api/me` and decide in the browser: works for the app shell later, but the landing would render an optimistic button during the fetch.
- A dedicated status endpoint: an extra request for one boolean.
- Hide the button when unconfigured: the specification requires a visibly disabled control with an explanation.

**Impact**
`src/app/page.tsx` is now an async server component that renders the sync `LandingPage` body; tests render `LandingPage` directly and call `HomePage` for the wiring. The helper is the single definition of "configured" for the start and callback routes and for any later settings screen. In this sandbox, with no credentials, the preview shows the disabled state.

---

## 2026-10-07: Sample conversation uses real songs, no durations, no Spotify ids

**Decision**
The landing sample shows three real songs by Nigerian artists chosen with the product owner (Free Mind by Tems, Essence by Wizkid and Tems, Calm Down by Rema) with one-line reasons, but keeps non-Spotify `sample-*` ids and omits durations.

**Why**
The previous rows were invented artists, which the trust rules forbid. Spotify is unreachable from the build environment, so durations and ids cannot be verified; showing unverified numbers or links would be invented data. The real `TrackRow` renders cleanly without a duration and without a link.

**Alternatives considered**

- Keep invented placeholders: rejected by the specification (A2).
- Type durations from memory: rejected, unverifiable.
- Fetch real ids and durations from Spotify: impossible offline; can be added later from a verified lookup if links are wanted.

**Impact**
`SampleTrack.durationMs` is optional. The "How it works" reason line is derived from the first sample track so the two never drift, and its last thinking line no longer states an invented result count.

---

## 2026-10-07: Legal pages are drafts derived from the code, with marked placeholders

**Decision**
Replace the bracketed prompt placeholders with full drafts of the Privacy Policy, Terms of Service, and Spotify Attribution written from the code paths that handle scopes, storage, cookies, AI requests, and data controls. Each page is labelled "Draft for review", carries a notice that it is not in force, marks unknown values (operator name, contact email, hosting provider, governing law) as visible placeholders, and ends with a list of what a reviewer must confirm.

**Why**
Honest drafts the owner can review beat empty prompts, and tying each statement to a code path keeps them accurate. The owner chose placeholders over typing the operator details during this phase.

**Alternatives considered**

- Keep prompts until a lawyer writes the text: leaves the footer pointing at pages with no information.
- Publish without the draft label: would present unreviewed text as binding.

**Impact**
Tests check that every Spotify scope in `src/lib/spotify.ts` and the session cookie facts in `src/lib/session.ts` appear on the privacy page, so a scope or cookie change fails the build until the page is updated.

---

## 2026-10-07: Keep Fredoka Variable and Bagel Fat One as the typefaces

**Decision**
Keep the existing interface typeface (Fredoka Variable) and display typeface (Bagel Fat One) rather than moving to one of the typefaces listed in the master specification.

**Why**
The product owner chose to keep them when asked on 2026-10-07, with the trade-offs stated: neither is on the specification's preferred list, and neither ships tabular figures, so durations rely on the `tabular-nums` width utility rather than the font.

**Alternatives considered**

- Instrument Sans with Instrument Serif: the recommended editorial pairing, installable from the npm registry.
- Geist, or Manrope, for the interface; Fraunces for display.
- Satoshi or General Sans: not installable from this environment (Fontshare is not reachable).

**Impact**
The type scale is built around weight and size rather than a serif contrast. The width hack for numerals stays. The decision can be revisited in a later design pass; the hero wordmark is SVG and does not depend on either font.

---

## 2026-10-07: A development-only design system reference route

**Decision**
Add `/design-system`, rendered from the real primitives and tokens, served in development only (`notFound()` in production builds).

**Why**
Each phase requires checking the interface in a browser at desktop and mobile widths and with reduced motion. A page that renders every token, type level, button state, field state, focus style, and motion rule from the same components the product uses makes that check repeatable and keeps the design system honest. Contrast ratios on the page are computed from the tokens rather than typed in.

**Alternatives considered**

- Storybook or a similar tool: heavier dependency footprint and a second build pipeline for a single-package app.
- No reference page: verification would rely on reading CSS and visiting product screens that do not yet exercise every state.

**Impact**
One extra route in development. The page is excluded from indexing and returns 404 in production, verified with `next start`.

---

## 2026-10-07: Two low-contrast tones, one danger tone, tighter radii, split focus rules

**Decision**

- Keep `--color-text-muted` at `#85858C` (5.4:1 on the background) as the darkest tone for small text, and add the specification's `#6B6B73` as `--color-text-faint` (3.7:1) for large text, disabled text, and decorative details only.
- Add `--color-danger` (`#E8705F`, 6.5:1) for error text and invalid field edges, replacing ad hoc Tailwind reds over time.
- Set `--radius-md` to 6px and `--radius-lg` to 8px (previously 8px and 12px) so controls stay within the 2px to 6px range.
- Replace the single `!important` focus outline with two rules: a 2px offset accent ring for links and buttons, and an accent edge for fields. The old rule forced a floating ring onto every field, including the chat composer, which already had its own softer treatment, so fields showed two indicators.
- Make the Tailwind theme `static` so unused tokens still reach the browser as CSS variables.

**Why**
The specification lists `#6B6B73` as the muted tone, but at that value small text fails WCAG AA, and the existing screens use the muted tone at 12px to 14px in 84 places. Keeping the AA-safe tone for small text and introducing the specification's value for large and decorative use satisfies both the palette and the accessibility requirement without a sweep across screens that belong to later phases. The screens already used Tailwind reds for errors in more than ten places, so a token is a consolidation, not an addition.

**Alternatives considered**

- Set muted to `#6B6B73` and move small-text usages to `secondary`: large churn across files that the open pull request #8 also edits, and a visibly brighter interface.
- Keep radii at 8px and 12px: outside the specification's stated range for controls.
- Keep the `!important` outline: guaranteed a ring everywhere, but produced double indicators on fields and prevented any refinement.

**Impact**
Palette and radius changes apply through the tokens with no per-screen edits. Components that disable the outline must supply their own ring; an audit found every current `outline-none` sits on a field that also sets an accent border, so nothing lost its indicator. Contrast guarantees are now unit tested.

---

## 2026-10-07: Prettier is configured but not yet applied repository-wide

**Decision**
Add `.prettierrc` (single quotes, semicolons, trailing commas, 80 columns) and `.prettierignore`, plus a `format:check` script, without running `prettier --write` across the codebase in this phase.

**Why**
The configuration matches the dominant existing style (single-quote imports outnumber double-quote imports roughly ten to one), but 101 of 150 files under `src/` still differ from Prettier output. Reformatting them now would touch most of the files changed by the open pull request #8 and create avoidable merge conflicts.

**Alternatives considered**

- Apply formatting immediately: cleanest end state, but it would conflict with PR #8 and mix a mechanical change into a foundation phase.
- Leave Prettier unconfigured: the `format` script already existed, so leaving it without a config would keep producing inconsistent results.

**Impact**
`npm run format:check` reports differences but is not part of `npm run verify` yet. A dedicated formatting-only commit should follow once PR #8 is merged or closed, after which `format:check` can join `verify`.

---

## 2026-10-07: `dev:stack` applies the schema automatically only to loopback databases

**Decision**
`scripts/dev.mjs` runs `drizzle-kit push` without asking only when `DATABASE_URL` points at `127.0.0.1`, `localhost`, or `::1`. For any other host it skips the push and tells the developer to run `npm run db:push` deliberately.

**Why**
A one-command startup is only safe if it cannot modify a shared or production database by accident. The hostname is a simple, reliable signal that the target is a throwaway local database.

**Alternatives considered**

- Always push: convenient, but a developer with a hosted `DATABASE_URL` in `.env.local` would mutate that database on every start.
- Never push automatically: safe, but it makes the "one command" startup a two-command startup for everyone.

**Impact**
Local Docker and locally installed PostgreSQL work with a single command. Hosted databases keep the existing explicit `drizzle-kit push` step. The script never uses `--force`, so destructive schema changes still prompt.

---

## 2026-10-07: Keep npm as the package manager for now

**Decision**
Keep npm and the committed `package-lock.json` instead of switching to pnpm.

**Why**
The master specification asks for pnpm workspaces, but the project is a single package, and the open pull request #8 modifies `package-lock.json`. Switching lockfiles now would guarantee a conflict with that work for no functional gain. pnpm is obtainable through corepack if the decision is revisited.

**Alternatives considered**

- Switch to pnpm immediately: aligns with the specification, conflicts with PR #8.
- Adopt pnpm workspaces: only meaningful if the repository is split into multiple packages, which the stack decision below rules out for now.

**Impact**
All documentation and scripts use `npm`. Revisit after PR #8 is resolved if a workspace split ever becomes necessary.

---

## 2026-10-07: Keep Drizzle ORM instead of migrating to Prisma

**Decision**
Keep the existing Drizzle ORM schema and queries. The database connection check required by Phase 1 already exists: `GET /api/health` runs `select 1` through Drizzle and returns `{"ok":true}` or a 500 `{"ok":false}` without leaking details.

**Why**
The schema in `src/db/schema.ts` already matches the models in the specification (users, Spotify accounts, music profiles, conversations, messages, playlists, playlist tracks, recommendations, preferences) plus sessions, memories, and rate limits. Replacing the ORM would rewrite every API route and database test for parity with a tool name, not for a product outcome.

**Alternatives considered**

- Migrate to Prisma: matches the specification text, high churn, no functional gain.
- Run both: two ORMs against one schema is a maintenance liability.

**Impact**
Schema changes continue to go through `drizzle-kit push` locally and through the deployment change process elsewhere. The specification's Prisma references map to Drizzle in this repository.

---

## 2026-10-07: Keep the Next.js App Router application instead of rebuilding as a Vite + Express monorepo

**Decision**
Continue building MUSE on the existing Next.js 16 App Router application (React 19, TypeScript strict, Tailwind CSS 4, Motion, TanStack Query, Zod, Drizzle ORM, PostgreSQL). Phase 1 becomes a foundation audit and gap-fill rather than a project initialization.

**Why**
The repository already contains about 24,500 lines of MUSE work across seven merged pull requests: the landing page with its signature animation system, the app shell, Spotify OAuth, the Spotify service, the AI pipeline, chat, playlists, library, discover, profile, memory, settings, security middleware, and 277 passing tests. The master specification requires improving existing MUSE work rather than rebuilding it, treats the existing animation system as mandatory, and requires stopping to ask before expensive architectural changes. The decision was confirmed with the product owner on 2026-10-07.

**Alternatives considered**

- Rebuild as the specified Vite client + Express server + shared package monorepo with Prisma: a ground-up rewrite of every route, the SSR-driven hero entrance, session handling, and the test suite, with high regression risk and no user-facing gain.
- Keep Next.js but split into pnpm workspaces: adds packaging overhead to a single deployable with no present need for shared packages.

**Impact**

- Frontend and API routes deploy together as one Next.js application. The specification's "independently deployable frontend and backend" requirement is not met in the literal sense; the API routes remain a clean server-side boundary (`src/app/api/*`, `src/lib/*`) if a split is ever needed.
- Specification references to Express routes, React Router, and Prisma map to Next.js route handlers, the App Router, and Drizzle respectively.
- Verification in the Phase 1 sandbox was limited to TypeScript, ESLint, Vitest, the production build, HTTP checks against the running dev server, and a real PostgreSQL 16 instance. No browser automation was available there, and Docker was not available either; the Compose file follows the documented `postgres:16-alpine` image and must be exercised on a machine with Docker.
