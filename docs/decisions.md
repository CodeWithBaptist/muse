# MUSE decision log

Section 77 of the master specification requires a decision log for meaningful architectural
decisions. Format per decision: Decision, Why, Alternatives considered, Impact, Date.

Entries marked **AWAITING APPROVAL** are proposals. They are recorded so the reasoning is
durable, and they are not adopted until explicitly approved.

---

## D-001. Keep the existing Next.js architecture rather than rebuilding as a Vite plus Express monorepo

Status: **ADOPTED** on 2026-10-05, by instruction to proceed with the recommendation. The
deviations listed below remain in force and should be revisited if independent deployment of
frontend and backend becomes a hard requirement.

Date: 2026-10-05

### Decision

Keep MUSE as a single Next.js 16 App Router application using Drizzle ORM, and treat Phase 1 as
verification and gap closing on the existing foundation instead of a rebuild.

### Why

A substantial MUSE implementation already exists and passes verification. Observed on 2026-10-05
in this workspace:

- `npx tsc --noEmit`: pass, zero errors
- `npx eslint .`: pass, zero errors, six `<img>` warnings
- `npx vitest run`: 27 files, 181 tests, all passing
- `npm run dev`: boots, ready in 410ms
- `GET /api/health`: `500 {"ok":false}`, honest because no `DATABASE_URL` is configured
- `GET /api/me`: `200 {"authenticated":false}`
- `GET /api/ai/status`: `200 {"connected":false,"code":"AI_NOT_CONNECTED"}`

The existing code already covers the substance of Phase 1 and most later phases: strict
TypeScript, ESLint, Prettier, a health endpoint, complete environment configuration, a documented
README, one command startup, Zod validation on API routes, and a Drizzle schema modelling every
entity section 45 requires plus sessions, memories and rate limits.

A rebuild could not be verified in this workspace. Docker is unavailable, PostgreSQL is
unavailable and cannot be installed because `apt-get update` fails against a blocked
`deb.debian.org`, `api.spotify.com` is unreachable, and Playwright browser downloads are blocked.
New Express routes, a Prisma schema and a `docker-compose.yml` written here would be unrunnable
and untestable code, which conflicts with section 1.4 (never claim something works when it has
not been verified) and section 76 (verification before done).

Section 1.1 directs that existing MUSE work be improved rather than rebuilt, and that working
code not be rewritten unnecessarily.

### Alternatives considered

1. **Full rebuild to the specified monorepo**: `client/` on Vite and React Router, `server/` on
   Express, `shared/`, Prisma, Docker Compose. Rejected for now because it discards verified work
   for no user visible capability gain, and because it cannot be verified in this environment.
2. **Hybrid**: add `pnpm-workspace.yaml` and a `shared/` package while keeping Next.js and
   Drizzle. Held as a fallback. It is additive and low risk, but it does not achieve independent
   deployment of frontend and backend on its own, so it buys less than it appears to.
3. **Switch package manager to pnpm**: pnpm 10.23.0 is available through `corepack pnpm`. Held.
   The repository has a committed `package-lock.json` and `npm ci` reproduces the install in
   about 23 seconds. Switching now means maintaining two lockfiles or regenerating one, with no
   product benefit.

### Impact

Adopting this decision means MUSE deviates from the master specification in these specific,
enumerated ways. Each is a conscious deviation, recorded rather than hidden:

| Specification | Requirement | Actual | Consequence |
|---|---|---|---|
| Section 15 | Frontend and backend independently deployable | Single Next.js deployment | **Real gap.** The one requirement the monolith genuinely does not meet |
| Section 15 | Vite, React Router, Express | Next.js App Router with route handlers | Equivalent capability, different topology |
| Section 15 | Prisma | Drizzle ORM | Equivalent capability; schema already complete |
| Section 15 | pnpm workspaces | npm with a committed lockfile | Tooling deviation only |
| Section 16 | `client/`, `server/`, `shared/` directories | `src/` with `app/`, `components/`, `lib/`, `db/`, `hooks/` | Structural deviation only |
| Phase 1 | Docker Compose PostgreSQL | Not present; Docker unavailable here | Local database setup must be documented for your machine instead |
| Section 21 | `/login` and `/callback` routes | 404; OAuth lives at `/api/auth/spotify` and `/api/auth/spotify/callback` | Real route gap, fixable without a rebuild |
| Section 21 | `/playlists/:id` | Not implemented; only `/playlists` | Real route gap, fixable without a rebuild |

If independent frontend and backend deployment is a hard business requirement rather than a
default preference, this decision should be overridden in favour of alternative 1, and the
migration should be performed in an environment that has Docker, PostgreSQL and Spotify API
access so it can actually be verified.

---

## D-002. Landing sample durations are omitted rather than approximated

Status: **ADOPTED and APPLIED** on 2026-10-05.

Date: 2026-10-05

### Decision

In the scripted landing demo, drop `durationMs` from the sample tracks instead of replacing the
current invented numbers with approximations from non-Spotify sources.

### Why

Section 73 A2 forbids inventing durations and metadata. The current file invents all three.
`api.spotify.com` is unreachable here, so Spotify's authoritative `duration_ms` cannot be
obtained. Public sources were checked and they disagree with each other: Lucky Daye's "Over" is
3:25 as a single and 3:27 on the album, and Wizkid's "Essence" appears as 4:06, 4:08 and 4:09
depending on source. Any number chosen would be a guess dressed as data.

### Alternatives considered

Resolve real Spotify durations on a machine with API access and commit those. This is better if
you want lengths displayed, and it is the recommended path should you prefer option 2.

### Impact

No component changes are required. `formatTrackDuration` already returns `null` for a missing or
non-positive value, `duration_ms` is optional on the `TrackRow` prop, and TrackRow renders the
label in a fixed `w-10` slot that is hidden below the `sm` breakpoint. Omitting it yields an
empty reserved slot on desktop and nothing on mobile, with no layout shift.

---

## D-003. Spotify disconnect retention is recorded as an open compliance gap

Status: **ADOPTED as a finding. Remediation not scheduled.**

Date: 2026-10-05

### Decision

Record, rather than silently fix, that disconnecting Spotify retains MUSE account identity,
saved memories and preferences, and the active session.

### Investigated against a real engine, 2026-10-07

The retention is now confirmed by integration test rather than by reading the route. Two
clarifications matter for the eventual policy decision.

Everything MUSE derived from Spotify is deleted on disconnect: tokens, recommendations,
profile insights including inferred mood and energy, conversations and their messages, and
playlists with their tracks. What survives falls into two groups. The identity row holds
`spotify_id`, email, display name, and avatar URL, all of which came from Spotify, so that
part is genuinely Spotify-derived personal data and is the substance of the compliance
question. The memories and preferences are a different case: both tables are only ever
written with `source: 'explicit'`, from text the user typed into MUSE, and no code path
writes an inferred row to either. Retaining them is therefore a normal account-settings
question rather than a Spotify data question, though under a regulation like GDPR they are
still personal data.

The gap remains open. The framing in the privacy draft is unchanged and still correct. What
the investigation adds is that remediation could be narrow: deleting the identity row on
disconnect would address the Spotify-derived part, while memories and preferences could
defensibly stay, since they are the user's own words and account deletion already removes
them. That is a legal judgement, not a technical one, and it is not made here.

The in-app policy note in Settings was also corrected. It said disconnect retains only
Spotify ID, email, and display name, which understated the behaviour by omitting the avatar
URL, saved memories and preferences, and the active session. The privacy draft was already
accurate; the text shown at the moment of the action was not.

### Why

`DELETE /api/me/spotify` deletes recommendations, music profiles, conversations with their
messages, playlists with their tracks, and Spotify tokens inside one transaction. It does not
delete the `users` row, the `memories` table, the `preferences` table, or the session.

Spotify's Developer Policy asks for deletion of a user's personal data and no further processing
after disconnection. The existing README already flags this. This log entry confirms it against
the code and keeps it visible.

### Impact

Any privacy text published must state the actual behaviour. The A3 privacy draft does so
explicitly. Remediation is a product decision with data loss implications, so it is not bundled
into a trust fix.

---

## D-004. Spotify configuration state is read on the server and passed to the hero

Status: **ADOPTED and APPLIED** on 2026-10-05.

### Decision

`src/app/page.tsx` computes whether Spotify OAuth can start and passes it to `Hero` as a boolean
prop. When it is false, the landing connection action renders disabled with the visible note
"Spotify connection is not configured yet." and an `aria-describedby` link to it.

### Why

Section 73 A4 forbids a nonfunctional action that looks functional. Previously the button always
rendered enabled and navigated to `/api/auth/spotify`, which returns a bare JSON 503 when
`SPOTIFY_CLIENT_ID` or `SPOTIFY_REDIRECT_URI` is missing.

The page already declares `dynamic = "force-dynamic"`, so environment configuration is read per
request rather than baked in at build time. Computing the state on the server keeps the check
identical to the one the authorize route performs, exposes only a boolean to the client, and
avoids adding an endpoint or a client side fetch that would race the first paint.

### Alternatives considered

1. **A status endpoint fetched by the client**, mirroring `/api/ai/status`. Rejected: it adds
   network surface and an intermediate state where the action could look enabled before the
   response arrives, which is the exact failure being fixed.
2. **Leaving the button enabled and rendering a friendly HTML page from the authorize route
   instead.** Rejected: it improves the destination but the action on the landing page would
   still look functional when it cannot work.

### Impact

Two tests that encoded the old behaviour were replaced rather than deleted. `landing.test.tsx`
now asserts that the action is disabled and labelled when credentials are absent, and enabled
when they are present.

`playwright.config.ts` supplies placeholder Spotify credentials to the test web server. Without
them the action renders disabled and the OAuth redirect in `auth.spec.ts` could not be exercised
at all. The suite intercepts `accounts.spotify.com`, so no real credential is used or exposed.
This configuration change could not be run here because Playwright browser downloads are blocked
in this workspace, and it is recorded as unverified.

A `tabindex="0"` appears on both hero buttons in the server markup. It is pre-existing behaviour
of the shared `Button` component and is present on the untouched "See how it works" action too,
so it was not introduced by this change. It is inert on a disabled control because browsers do
not focus disabled form elements.

---

## D-005. Legal placeholder component replaced by a document component

Status: **ADOPTED and APPLIED** on 2026-10-05.

### Decision

`LegalPlaceholder` was removed and replaced by `LegalDocument`, which renders prose sections,
lists, and per section notes instead of bracketed prompts. Privacy, Terms, and Spotify
attribution now carry real draft text written from the current implementation, each headed
"Draft pending legal review".

### Why

Section 73 A3 requires accurate drafts based on actual code rather than placeholders. A component
named `LegalPlaceholder` whose only content slot is called `prompt` cannot express real prose, so
keeping it would have meant either misusing the name or leaving the pages as templates.

### Impact

Clauses that genuinely require counsel are still marked as open, including limitation of
liability, governing law, the privacy contact address, the approved Spotify attribution wording,
and the approved Spotify brand asset. Those are left visibly incomplete rather than filled with
plausible boilerplate, because inventing them would breach the rule against claiming something
that has not been verified.

---

## D-006. Refinement context is rebuilt from stored conversation state, and enforced server side

Status: **ADOPTED and APPLIED** on 2026-10-05. Phase 9.

### Decision

A refinement turn rebuilds its context from data already stored: earlier user turns come from the
`messages` table and tracks already shown come from the `recommendations` table, both scoped to
the conversation. No new table, column, or migration was added.

Accumulated criteria and exclusions are re-derived each turn by one model call over the whole
conversation rather than being stored between turns.

Constraints are then enforced in `applyRefinementFilters`, which runs on the verified candidate
pool **before** the model ranks anything.

### Why

Section 26 requires that a refinement keep the original request, the structured criteria, the
tracks already shown, and the negative preferences, and that it not repeat tracks already shown.

Rebuilding from `messages` and `recommendations` means refinement needs no schema change, works
after a page reload, and cannot drift from what the user was actually shown, because the record
of what was shown is the same record the product writes for other reasons.

Filtering before ranking matters more than it looks. The model is told about exclusions, but AI
output is untrusted, so telling it is not enough. Removing an excluded artist from the candidate
pool means a model that ignores the instruction has nothing to select, and the existing guard
that drops any track id not present in the verified pool catches the rest. Two independent
layers, neither of which relies on the model cooperating.

Genre and descriptor exclusions cannot be enforced the same way, because Spotify track objects
carry no genre field and MUSE requests no audio features. They shape the search queries and the
ranking prompt instead. That is a real limitation and it is stated in the code rather than
implied to be stronger than it is.

### Alternatives considered

1. **Store accumulated criteria in a new table or column.** Rejected: needs a migration that
   cannot be verified in this workspace, since PostgreSQL is unavailable and cannot be installed.
   It also creates a second source of truth that can disagree with the message history.
2. **Send the whole conversation to the ranking call and let the model handle continuity.**
   Rejected: it puts an untrusted component in charge of a guarantee the product should keep, and
   it grows the prompt without bound.
3. **Keep refinement state in the browser session.** Rejected: it would be lost on reload, would
   not survive a conversation switch, and would trust the client with constraint state.

### Impact

`orchestrateRecommendations` gained an optional third parameter. With no context it behaves
exactly as before, which is why the existing tests pass unchanged: a fresh turn still makes two
model calls and applies no exclusions.

A refinement turn costs the same two model calls, because the refinement plan replaces the
single-message intent call rather than adding to it.

The chat route issues two extra indexed queries per turn, bounded at 24 messages and 400 shown
tracks. A failure to load context degrades to treating the turn as a new request instead of
failing the turn.

Matching an excluded artist uses whole-word boundaries, so excluding Rema does not exclude an
artist called Premier. Duplicate detection matches on Spotify id and on a folded title and artist
key, so a re-issue of the same recording under a different id is still caught.

Repeat detection is deliberately conservative. Only explicit wording such as "play those again"
re-serves shown tracks, because a false positive re-serves music the user has already seen, which
is the exact failure refinement exists to prevent.

### Not done

Rows that remain do not yet stay in place across turns. Each turn still renders its own list, so
a refinement shows a fresh set of rows rather than editing the previous set in place. Removed rows
now collapse within a playlist preview, and new rows use the existing staggered reveal, but a
single living list that carries rows across turns is a chat restructure that needs real browser
verification, which is not available in this workspace.

---

## D-007. Verify the database with an in-process Postgres, and commit the migrations

Status: **ADOPTED and APPLIED** on 2026-10-07.

### Decision

`@electric-sql/pglite` is added as a development dependency. It runs a real PostgreSQL engine
compiled to WebAssembly, in process, with no server to install. `src/test/database.ts` boots it
against the committed migrations and hands tests a Drizzle instance.

The generated migrations are committed to `drizzle/`, and `db:generate`, `db:migrate`, `db:push`,
`db:studio`, and `test:db` scripts are added to `package.json`.

Production is unaffected. It still connects to the PostgreSQL server named by `DATABASE_URL`
through `drizzle-orm/node-postgres`. PGlite is a test-time engine only.

### Why

The schema had never been executed by a real database. PostgreSQL cannot be installed in this
workspace, so every query was checked only by TypeScript and by unit tests that mock the data
layer. That combination verifies types and application logic, and says nothing about cascade
rules, index behaviour, transaction semantics, or timestamp resolution, all of which are
properties of the engine.

The cost of that gap was concrete. Refinement context ordering assumed the newest message sorts
last. Messages written in one statement share a `created_at`, because `now()` is the transaction
timestamp, and PostgreSQL does not guarantee the order of tied rows. The assumption had passed
typecheck, lint, and 208 unit tests, and the first execution of the migration against a real
engine exposed it in minutes.

Migrations were missing entirely, so nobody could create this database from the repository.
Committing them makes the schema reproducible and gives the test engine something to apply.

### Alternatives considered

1. **Install a PostgreSQL server.** Not possible here. The package index is unreachable, and
   Docker is absent. It would also make tests depend on a service, so they could not run
   everywhere.
2. **Keep mocking the data layer.** Rejected. It is what allowed the ordering assumption to
   survive, and it cannot verify cascade or index behaviour at all, since those live in the
   engine rather than in code.
3. **Use SQLite with a compatibility layer.** Rejected. The schema uses `uuid`, `jsonb`,
   `defaultRandom()`, and PostgreSQL cascade semantics. Translating them would test an
   approximation of the production database, which is the exact failure mode this exists to
   remove.
4. **Generate migrations in test setup instead of committing them.** Rejected. The repository
   needs migrations regardless, for deployment, and generating them at test time would hide
   schema drift between what is committed and what the code declares.

### Impact

Eleven integration tests now run the real engine in about three seconds. One instance is created
per file and truncated between tests; creating one per test cost twenty seconds, which is slow
enough that the suite would get skipped.

They verify the twelve tables the migration creates, the unique index the memory upsert depends
on, the cascade chain account deletion relies on, the rate limit cleanup pattern, the exact
disconnect retention described in D-003, both conversation deletion paths, and the message
ordering behind refinement.

Two of those tests assert behaviour that is a hazard rather than a bug. Deleting a conversation
directly orphans its recommendations, because the foreign key is `on delete set null`. No live
route does this, since both deletion paths remove recommendations explicitly first, so the risk
is dormant. The test documents it, which means removing that explicit delete in a refactor will
now fail loudly instead of quietly retaining data.

### Route handlers are covered too, without a refactor

This was first recorded as a residual limitation, on the reasoning that `src/db/index.ts` builds a
module-level singleton pool that cannot be substituted per test, so handlers could only be tested
by making the database injectable. That reasoning was wrong, and the limitation is closed.

Mocking `@/db` with a getter that resolves at call time is enough, because Drizzle calls happen
inside handlers rather than at module scope. Mocking `next/headers` to present a session cookie
lets the real `getSession` run against the real sessions table, so authentication is exercised
rather than stubbed. Building requests without an Origin header satisfies the CSRF guard, which
deliberately allows non-browser callers.

`src/app/api/routes.integration.test.ts` therefore drives real handlers end to end: conversation
deletion and its ownership check, the refinement context the chat route passes to the
recommendation engine, the disconnect retention described in D-003, and account deletion
including that other users are untouched. No production code changed to allow this, so the
dependency-injection refactor is no longer proposed.

What remains genuinely unverified is anything needing Spotify, OpenAI, or a browser. Those are
external services and cannot be reached from here.

### Related finding

`drizzle-kit generate` fails to read `drizzle.config.ts` when `--out` is passed on the command
line, reporting schema and dialect as undefined. Invoked without `--out` it reads the config
correctly. The committed scripts do not pass `--out`, so this does not affect them, but it is
worth knowing before adding a script that overrides the output folder.

## D-008: How a refinement treats the rows already on screen

**Decision.** Split "tracks already shown" into two categories with different rules. Rows in the current selection are re-evaluated against the refined criteria and kept when they still fit. Rows shown in an earlier turn and since replaced are retired and never recommended again. The client sends the ids currently on screen; the server keeps those rows in the list, adds new candidates around them, and reports kept, new, and removed counts. Recommended track metadata is stored with each recommendation so a surviving row can be redrawn from stored data. The chat surface renders one persistent list rather than a list per reply, and that list is where refinement happens.

**Why.** Section 26 asks for both "do not repeat tracks already shown" and "rows that remain should stay in place." The first implementation of Phase 9 satisfied the first clause by excluding every track previously shown, which made the second unreachable: every refinement returned a completely fresh list, so nothing ever remained. Asking to drop one artist threw away the other seven rows the visitor had already read and replaced them with eight different ones. That reads as MUSE ignoring the work it just did.

The two clauses are not actually in conflict once the categories are separated. "Do not repeat" exists so a track the visitor already rejected does not come back, which is about retired rows. "Rows remain" is about continuity of the list being edited, which is about the current selection.

A living list also requires being able to redraw a row it is keeping. `recommendations` stored a Spotify track id and a reason, enough to know what was recommended but not enough to render it. Resolving survivors through Spotify again was considered and rejected: the service has a single track endpoint and no batch resolver, so this would be one request per surviving row on every refinement turn, or would mean adding an endpoint MUSE has not verified. Section 5 forbids assuming endpoints exist, and this environment cannot reach Spotify to check. Denormalizing the five fields mirrors what `playlist_tracks` already does.

**Alternatives considered.**
1. Keep excluding all previously shown tracks. Simplest, and what Phase 9 shipped, but it makes "rows remain" impossible and wastes a list the visitor has already read.
2. Resolve survivors through Spotify at refinement time. No schema change, but N extra requests per turn against an unverified batch capability.
3. Store metadata as JSON rather than columns. Fewer migrations, but unqueryable and inconsistent with `playlist_tracks`.
4. Leave the list inside each assistant message. No new component, but every turn would own its own list, so rows could never stay in place across turns, which is the whole requirement.
5. Update the list inside the message that first produced it, keeping the list inline in the stream. Rows would stay in place, but the list drifts further from the input with every turn, which is where an iterative refinement conversation is actually happening.

**Impact.** `recommendations` gains five nullable columns (migration `0001`), and the chat route writes them alongside each recommendation. `ChatPostInputSchema` accepts `currentSelectionIds`, validated so only ids this user was actually recommended in this conversation are honoured; a crafted request cannot keep a row MUSE never resolved through Spotify. `applyRefinementFilters` now excludes retired tracks rather than all shown tracks, and `partitionCurrentSelection` splits the on-screen rows into survivors, rows ruled out by an accumulated exclusion, and rows too old to render, which are dropped rather than shown blank. The ranking prompt marks survivors so the model can keep them and fill remaining slots. `ChatMessage` no longer renders tracks; `SelectionPanel` owns the one list, which also means a reply can no longer draw a second copy of it. Rows without stored metadata are never keepable, so lists recommended before migration `0001` will fully replace on their first refinement rather than partially update.

**Date.** 2026-10-07

## D-009: Migrate playlist writes to the endpoints Spotify kept

**Decision.** Move the two playlist writes in the export route to their current endpoints: `POST /users/{id}/playlists` becomes `POST /me/playlists`, and `POST /playlists/{id}/tracks` becomes `POST /playlists/{id}/items`. Request bodies are unchanged in both cases. Alongside that, a refusal from the add-items call is now classified: statuses meaning the call itself cannot succeed (401, 403, 404, 405, 429) abort with a specific message, and only other failures fall through to the existing per-track retry that identifies which tracks Spotify rejected.

**Why.** Spotify's February 2026 Web API changes removed both endpoints MUSE was calling. The changelog names the replacements directly, and the March 2026 changelog reverted only two field removals (`Album.external_ids`, `Track.external_ids`), so no endpoint removal was walked back. The reference for the new add-items endpoint confirms the body is still a JSON `uris` array capped at 100 items, answered with 201 and a `snapshot_id`, under the same `playlist-modify-public` and `playlist-modify-private` scopes MUSE already requests. `POST /me/playlists` takes the same `name`, `description`, and `public` fields, so the migration is a URL change in both places.

The failure classification is not cosmetic. When a chunk failed, the route retried every track individually and listed each one as rejected. Against a removed endpoint that meant N extra requests followed by a report claiming every track had been refused, which blames the music for a problem with the call and pushes the visitor towards a retry that cannot work. A 401 now routes through the existing reconnect path, so the client offers the action that would actually help.

**Alternatives considered.**
1. Leave the calls as they are until the quota mode is known. Extended Quota Mode apps keep the old endpoints working, so this might not be broken. Rejected: the new endpoints are the documented ones, so migrating is correct in both modes, and waiting leaves a shipping feature depending on an assumption nobody has checked.
2. Move both calls into `spotify-service.ts`. Better consistency, since this route is the only place that calls Spotify directly, but it is a wider refactor than a bug fix and was left out deliberately.
3. Keep the per-track retry for all failures. Simpler code, and it is the right behaviour when a track genuinely cannot be added, but it produces a misleading report when the call itself is broken.
4. Raise `ADD_CHUNK_SIZE` from 25 to the new 100 maximum. Fewer requests, but it changes retry granularity and is unrelated to the fix.

**Impact.** `src/app/api/playlists/export/route.ts` only, plus a new test file that intercepts every call under `api.spotify.com` against a real database. Seven tests pin the two URLs, assert that no removed endpoint is called, and cover the 404, 401, and partial-failure paths, including that a systemic failure makes exactly one attempt rather than a retry storm.

Unresolved and worth checking against the Spotify dashboard: which quota mode this app is in. Development Mode apps were migrated on 9 March 2026 and are capped at five users with one client ID per developer, and stop working entirely if the owner's Premium subscription lapses. Extended Quota Mode apps are unaffected by all of it. If MUSE is in Development Mode, the five user ceiling matters more than any feature work.

Two further constraints found while verifying, neither requiring a change now. `GET /search` dropped its maximum limit from 50 to 10 and its default from 20 to 5; MUSE searches with a limit of 8, so it is inside the cap but with little margin left. `GET /artists/{id}/top-tracks` was removed, which is the obvious endpoint for an "explore this artist" affordance, so that will need to go through search like the rest of MUSE's discovery. MUSE uses `popularity`, `followers`, and `available_markets` nowhere, so the wider set of field removals does not affect it.

**Date.** 2026-10-07

## D-010: Reorder stays inside MUSE, and evolution previews cannot write

**Decision.** Track reorder persists to `playlist_tracks.position` in MUSE only. Where a playlist also exists in Spotify, the page states plainly that the order there is unchanged. Playlist evolution is split across two handlers: a preview handler with no write path of any kind, and a separate confirm handler that re-resolves every track id through Spotify and stores the metadata Spotify returns.

**Why.** Section 34 requires that nothing changes in Spotify until the visitor explicitly confirms, and that an existing Spotify playlist is never modified silently. Putting the preview in a handler that cannot write makes that a structural property rather than a convention someone has to remember.

Reorder is different. Spotify's replacement endpoint supports either reorder or replace, and replace overwrites the playlist's items outright. If the visitor added tracks in Spotify since MUSE last saw the playlist, a replace would delete them. That is a destructive write triggered by a drag gesture, which is not a trade worth making without an explicit decision about reconciliation. So reorder stays in MUSE and says so, instead of quietly diverging or quietly destroying.

Confirming an evolution re-resolves each track rather than trusting the client. The ids arrive from the browser, and storing whatever metadata came with them would let a crafted request put invented titles and artists into a playlist that MUSE then displays. Section 29 requires every displayed track to be resolved through Spotify, so the confirm handler calls Spotify for each id and keeps what comes back.

**Alternatives considered.**
1. Write reorder to Spotify using replace. One call, and the orders would match. Rejected as destructive whenever the two have diverged.
2. Write reorder using a sequence of range moves. Not destructive, but the endpoint takes one range per call, so an N track reorder is up to N requests, and a failure part way through leaves the playlist in an order nobody chose.
3. Keep evolution in one handler with a `confirmed` flag. Fewer files, but then the preview path can write, and the guarantee becomes a conditional instead of a structure.
4. Trust client metadata on confirm and verify only when adding to Spotify. Cheaper, and Spotify would reject bad ids, but a MUSE draft never reaches Spotify, so unverified metadata would be stored and displayed.
5. Define the evolution intents in the engine. Rejected after it broke the build: the client component imported the labels, which pulled the engine, its Spotify service, and the database driver into the browser bundle.

**Impact.** `PATCH /api/playlists/:id` accepts `trackOrder` and requires it to be a permutation of the tracks the playlist actually has, applied in one transaction so two rows cannot end up claiming the same position. Two new routes sit under `/api/playlists/:id/evolve`. One shared module now holds the add-items call that the export route used to make on its own. The reorder handle is a real button that also moves the row with the arrow keys, because drag alone is not usable by keyboard and competes with scrolling on touch.

Still open: the confirm handler's behaviour against a real database is not covered by a handler level test, and reorder does not reach Spotify at all. Both are known gaps rather than finished work.

**Date.** 2026-10-07
