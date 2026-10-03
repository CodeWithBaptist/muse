# MUSE

MUSE is an AI music companion built on Spotify with Next.js (App Router), PostgreSQL, Drizzle ORM, Tailwind CSS, Motion, TanStack Query, Zod, and OpenAI.

## Tech Stack

* **Framework:** Next.js 16 (App Router)
* **Database:** PostgreSQL (Neon) with Drizzle ORM
* **Styling:** Tailwind CSS 4
* **Motion:** Motion (`motion/react`)
* **State and Data Fetching:** TanStack Query
* **Validation:** Zod
* **AI Provider:** OpenAI (`src/lib/ai/provider.ts`)
* **Testing:** Vitest and Testing Library

## Scripts

* `npm run dev`: Start the local Next.js development server
* `npm run build`: Run a production Next.js build
* `npm run start`: Start the production server
* `npm run typecheck`: Run TypeScript type checking (`tsc --noEmit`)
* `npm run lint`: Run ESLint across the repository
* `npm run test`: Run the Vitest test suite once
* `npm run format`: Format files with Prettier

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your credentials:
   ```bash
   cp .env.example .env.local
   ```

3. Push the Drizzle schema to your PostgreSQL database:
   ```bash
   npx drizzle-kit push
   ```

4. Start the development server and open `http://127.0.0.1:3000`:
   ```bash
   npm run dev
   ```

## DEPLOY

### 1. Environment Variables

Configure these six environment variables in `.env.local` for local development and in Vercel Project Settings under Environment Variables for production:

* `DATABASE_URL`: PostgreSQL connection string (use the pooled Neon connection string for serverless deployments on Vercel).
* `SPOTIFY_CLIENT_ID`: Client ID from the Spotify Developer Dashboard.
* `SPOTIFY_CLIENT_SECRET`: Client Secret from the Spotify Developer Dashboard.
* `SPOTIFY_REDIRECT_URI`: OAuth callback URL matching the environment (`http://127.0.0.1:3000/api/auth/spotify/callback` locally, or `https://muse-six-pink.vercel.app/api/auth/spotify/callback` in production).
* `OPENAI_API_KEY`: OpenAI API key. If unset or set to `add-later`, the app runs without crashing and shows an explicit "AI is not connected yet" state in chat, discover, and profile views.
* `ENCRYPTION_KEY`: 32-character secret key used to encrypt Spotify tokens at rest. Generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
  ```

### 2. Spotify Dashboard Configuration

1. In the Spotify Developer Dashboard, open your app settings and register both Redirect URIs:
   * `http://127.0.0.1:3000/api/auth/spotify/callback` (use `127.0.0.1` rather than `localhost` per Spotify redirect URI requirements)
   * `https://muse-six-pink.vercel.app/api/auth/spotify/callback`
2. Open **User Management** in the Spotify Developer Dashboard and add the full name and Spotify account email address of every tester. Spotify apps in development mode only allow listed users to authenticate and call the API.

### 3. Database Schema Push

`drizzle-kit push` is not executed during the Vercel build. Run it once manually against your production database before or after deploying:

```bash
DATABASE_URL="your_production_neon_url" npx drizzle-kit push
```

### 4. Post-Deploy Health Check

After deploying to Vercel, verify database connectivity by visiting:

```text
https://muse-six-pink.vercel.app/api/health
```

A healthy database connection returns HTTP 200 with `{"ok":true}`. If the database is unreachable or unconfigured, it returns HTTP 500 with `{"ok":false}` without exposing credentials or internal error details.
