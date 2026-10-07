# MUSE decision log

Meaningful architectural and product decisions, newest first. Each entry records the decision, why it was made, the alternatives considered, the impact, and the date. Add an entry before making a change that would be expensive to reverse.

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
