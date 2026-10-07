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
