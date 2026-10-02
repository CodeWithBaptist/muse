# MUSE
## AI Music Companion

MUSE is a production-quality AI music companion built on top of Spotify. It features natural language chat, AI-powered music discovery, and seamless playlist generation.

## Tech Stack
- **Framework:** Next.js (App Router)
- **Database:** PostgreSQL with Drizzle ORM
- **Styling:** Tailwind CSS
- **Animations:** Motion (Framer Motion)
- **Validation:** Zod
- **Testing:** Vitest

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up your environment variables:
   - `DATABASE_URL`: PostgreSQL connection string
   - `SPOTIFY_CLIENT_ID`: Your Spotify app client ID
   - `SPOTIFY_CLIENT_SECRET`: Your Spotify app client secret
   - `SPOTIFY_REDIRECT_URI`: Your Spotify app redirect URI
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `ENCRYPTION_KEY`: A 32-character key for encrypting Spotify tokens

3. Push the database schema:
   ```bash
   npx drizzle-kit push
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

## Structure
- `src/app`: Next.js pages and API routes
- `src/components`: UI components
- `src/db`: Database schema and client
- `src/lib`: Shared utilities and service logic
- `src/hooks`: Custom React hooks
- `src/types`: TypeScript type definitions
