# CLAUDE.md

Project memory for Claude Code. Keep this file under ~150 lines and update it when conventions change.

## What MUSE is

MUSE is an AI music companion built on the Spotify Web API. Users connect their Spotify account, chat with an AI companion, get recommendations and playlists, and optionally start playback. The app sends playback commands to Spotify; it never streams audio.

## Commands

```bash
npm ci                # install locked dependencies (prefer ci over install)
npm run dev           # Next.js dev server on http://127.0.0.1:3000
npm run build         # production build
npm run typecheck     # tsc --noEmit
npm run lint          # eslint .
npm run test          # Vitest unit + component tests
npm run test:e2e      # Playwright (mocks /api, no real Spotify/Anthropic/DB calls)
npm run test:e2e:list # list e2e tests without a browser
npm run format        # prettier --write .
npm run check:ai      # live smoke test of the configured AI provider (1 real API call)
npm run check:setup   # validate all local config: env vars, DB connection, tables, AI
npm run setup         # guided first-run: install, create .env.local, push schema, verify

npx drizzle-kit push  # apply schema to the target DB (verify the target first)
```

Run `npm run typecheck && npm run lint && npm run test` after any change that touches `src/`. E2E requires `npx playwright install chromium` once and binds port 3100 (`PLAYWRIGHT_BASE_URL` overrides).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · PostgreSQL + Drizzle ORM · Tailwind CSS 4 · Motion · TanStack Query · Zod 4 · Anthropic + Google Gen AI SDKs · Vitest + Testing Library + Playwright + axe-core.

## Layout

- `src/app/` — App Router pages. `(app)/*` are authenticated routes; `api/*` are route handlers.
- `src/components/` — feature-grouped UI (`chat`, `landing`, `shell`, `playlist`, `settings`, `ui`).
- `src/lib/` — domain logic: `ai/` (provider, recommend/discover/profile engines, user memory), `spotify*.ts`, `security/` (csrf, rate-limit), `session.ts`, `encryption.ts`, `validation/api-schemas.ts`.
- `src/hooks/`, `src/db/` — client hooks and Drizzle client + `schema.ts`.
- Tests sit next to source as `*.test.ts(x)`; browser tests live in `tests/e2e/*.spec.ts`.
- `@/*` maps to `./src/*` (tsconfig paths + Vitest alias).

## Conventions

- Every API route handler: `export const runtime = 'nodejs'`, authenticate with `getSession()`, validate input with a Zod schema from `src/lib/validation/api-schemas.ts`, call `verifySameOrigin(request)` (CSRF) and `enforceRateLimit(...)` on mutating routes, and return `NextResponse.json(...)`.
- Errors: return structured JSON with a safe message. Never leak credentials, internal error text, or stack traces. The chat route keeps an allowlist of error names/codes — follow that pattern rather than forwarding raw provider errors.
- Server-only code stays server-only: never import `src/db`, `src/lib/spotify-tokens.ts`, `src/lib/encryption.ts`, or anything reading `SPOTIFY_CLIENT_SECRET` / `OPENAI_API_KEY` into a client component.
- Spotify OAuth tokens are encrypted at rest with AES-256-GCM (`src/lib/encryption.ts`). Do not log raw tokens.
- AI features go through `src/lib/ai/provider.ts`. It is a facade over one of two interchangeable providers in `src/lib/ai/providers/` (`anthropic.ts`, `gemini.ts`); those are the only modules allowed to import a vendor SDK. Keep the vendor-specific parts there and the shared contract in `providers/shared.ts`.
- `getAIProviderId()` picks the provider: an explicit `AI_PROVIDER` wins, otherwise whichever key is configured, defaulting to Anthropic. Anything reading provider state (status route, Settings, `scripts/check-ai.mjs`) must go through that helper rather than testing for one vendor's key.
- Providers implement `complete`/`stream`/`extractText`. `extractTextContent()` in the facade tolerates either response shape, so route code never branches on the vendor. `structuredCompletion()` asks for JSON, then validates with the caller's Zod schema — Gemini additionally sets `responseMimeType`, which is why that path must stay in the provider and the schema check must stay in the facade.
- When no provider key is set or the value is a placeholder, `isAIConfigured()` is false and the UI must show the explicit "AI is not connected yet" state instead of failing. User-supplied text passes through `sanitizePromptInput()`.
- `Message` includes a `system` role for callers, but no provider accepts it in the turn list: `normalizeConversation()` hoists system turns, drops empty turns, merges same-role turns, and trims a leading assistant turn. Do not build provider request bodies from raw message arrays.
- UI: Tailwind utilities, `Surface`/`Button`/`Input` primitives from `src/components/ui/`, `clsx` + `tailwind-merge` via `src/lib/utils.ts`. Respect reduced motion.
- Match the surrounding style and do not run `prettier --write` across the repo. There is no Prettier config, so the defaults disagree with the committed style (the codebase uses single quotes and wider lines); formatting whole files buries real changes in unrelated churn.

## Data deletion

- `deleteUserAccountData()` in `src/lib/user-data.ts` is the single path for removing a user's data, used by both `DELETE /api/me/account` and `DELETE /api/me/spotify`. Do not hand-roll partial deletes in a route: two routes each deleting a different subset is exactly how MUSE previously violated Spotify's disconnect-deletion requirement by keeping the Spotify identity row.
- `USER_SCOPED_TABLES` lists every table that routine must clear. If you add a user-scoped table, add it there and to `deleteUserAccountData`; the security test compares the actual deleted table set against that constant, so an omission fails the suite.
- Disconnecting Spotify deletes the whole account by design, because MUSE's only user identity is the Spotify account (`users.spotifyId`). Callers must clear the session cookie afterwards; the settings panel signs the user out.

## Non-negotiables

- Never commit secrets or `.env*` files (only `.env.example` is tracked). Never put secrets in client code, browser storage, logs, or screenshots.
- Security headers (including the CSP) live in `next.config.ts`. If you add a new external origin (API, image host, font), update the matching CSP directive in the same change.
- Do not "fix" the unresolved items flagged in `README.md` (Spotify policy compliance, attribution page, token deletion on disconnect, Next.js advisories) by silently changing behavior — those are deliberate open review items.
- Tests mock Spotify, Anthropic, and the database. Passing tests do not prove live API compatibility; do not claim otherwise.
- Don't run destructive DB commands or point `drizzle-kit push` at anything but a development database.

## Local setup notes

`npm run check:setup` is the supported way to diagnose a broken local setup. It reads the expected table names out of `src/db/schema.ts`, so keep that regex-compatible (`pgTable("name"`) if you ever change the schema style. Its AI check must keep delegating to `scripts/check-ai.mjs` rather than reimplementing provider detection, otherwise the two drift.

Copy `.env.example` → `.env.local` and fill in `DATABASE_URL`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, `ENCRYPTION_KEY`, and one AI key: `ANTHROPIC_API_KEY` (paid) or `GEMINI_API_KEY` (free tier). `AI_PROVIDER`, `ANTHROPIC_MODEL`, and `GEMINI_MODEL` are optional. Spotify requires HTTPS except loopback, and rejects `localhost` — use `http://127.0.0.1:3000/api/auth/spotify/callback` for local dev. `/api/health` returns `{"ok":true}` (200) with a working database, `{"ok":false}` (500) otherwise.
