#!/usr/bin/env node
/**
 * MUSE setup doctor.
 *
 *   npm run check:setup
 *
 * Validates everything the app needs to run locally and reports what is
 * missing or wrong, in the order you should fix it. Exits non-zero if any
 * required piece is not ready.
 *
 * Checks (in order):
 *   1. Node version
 *   2. .env.local present
 *   3. AI provider key (free Gemini or paid Anthropic) — live call
 *   4. DATABASE_URL — actually connects, and the tables exist
 *   5. Spotify credentials — present and correctly shaped
 *   6. ENCRYPTION_KEY — long enough and not the example value
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envLocalPath = path.join(repoRoot, '.env.local');
const envPath = path.join(repoRoot, '.env');

dotenv.config({ path: [envLocalPath, envPath], quiet: true });

const results = [];

function pass(title, detail) {
  results.push({ level: 'ok', title, detail });
}

function warn(title, detail) {
  results.push({ level: 'warn', title, detail });
}

function fail(title, detail, fix) {
  results.push({ level: 'fail', title, detail, fix });
}

const normalize = (value) => value?.trim().toLowerCase() ?? '';

function isPlaceholder(value) {
  const normalized = normalize(value);
  if (!normalized) return true;
  return (
    normalized.includes('add-later') ||
    normalized.includes('add_later') ||
    normalized === 'placeholder' ||
    normalized === 'changeme' ||
    normalized === 'none' ||
    normalized.includes('your-') ||
    normalized.includes('your_') ||
    normalized.includes('example') ||
    normalized.includes('replace_with') ||
    (normalized.startsWith('<') && normalized.endsWith('>'))
  );
}

// ---------------------------------------------------------------- 1. Node

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor >= 20) {
  pass(`Node.js ${process.versions.node}`);
} else {
  fail(
    `Node.js ${process.versions.node} is too old.`,
    'Next.js 16 needs Node 20 or newer.',
    'Install Node 20+ (https://nodejs.org) and re-run.'
  );
}

// ------------------------------------------------------------ 2. .env.local

if (!existsSync(envLocalPath)) {
  const hasEnv = existsSync(envPath);
  fail(
    'No .env.local file.',
    hasEnv
      ? 'Found a .env file instead. .env.local is the documented file and is git-ignored.'
      : 'This is the file that holds your local configuration.',
    'Run:  cp .env.example .env.local\n     then open .env.local and fill in the values below.'
  );
} else {
  pass('.env.local found');
}

// ------------------------------------------------------------ 3. AI provider

const providerScript = path.join(repoRoot, 'scripts', 'check-ai.mjs');
const aiRun = spawnSync(process.execPath, [providerScript], {
  cwd: repoRoot,
  encoding: 'utf8',
});

const aiOutput = `${aiRun.stdout ?? ''}${aiRun.stderr ?? ''}`;
const aiProvider =
  process.env.AI_PROVIDER?.trim().toLowerCase() ||
  (process.env.ANTHROPIC_API_KEY?.trim() &&
  !isPlaceholder(process.env.ANTHROPIC_API_KEY)
    ? 'anthropic'
    : process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
      ? 'gemini'
      : 'none');

if (aiRun.status === 0) {
  const model = aiOutput.match(/model:\s+(\S+)/)?.[1] ?? 'default model';
  pass(`AI provider (${aiProvider}) — live call succeeded`, `model: ${model}`);
} else if (aiProvider === 'none') {
  fail(
    'No AI provider key configured.',
    'MUSE needs one to answer in chat, recommend tracks, and build Discover sections.',
    'Free option, no credit card:\n' +
      '  1. Go to https://aistudio.google.com/apikey\n' +
      '  2. Create an API key\n' +
      '  3. In .env.local set:  GEMINI_API_KEY=AIza...\n' +
      'Then run: npm run check:ai'
  );
} else {
  const firstProblem =
    aiOutput
      .split('\n')
      .find((line) => line.trim().startsWith('✗') || line.includes('Provider said')) ??
    'See `npm run check:ai` for details.';
  fail(
    `AI provider (${aiProvider}) is configured but the live call failed.`,
    firstProblem.trim(),
    'Run `npm run check:ai` on its own to see the full diagnosis.'
  );
}

// -------------------------------------------------------------- 4. Database

/** Read the expected table names from the schema so this cannot drift. */
async function readSchemaTables() {
  const source = await readFile(path.join(repoRoot, 'src', 'db', 'schema.ts'), 'utf8');
  return [...source.matchAll(/pgTable\(\s*["'`]([a-z_]+)["'`]/g)].map((match) => match[1]);
}

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  fail(
    'DATABASE_URL is not set.',
    'MUSE stores users, conversations, and playlists in PostgreSQL.',
    'Free option: create a database at https://neon.tech, then paste its\n' +
      'connection string into .env.local as DATABASE_URL.'
  );
} else if (isPlaceholder(databaseUrl)) {
  fail(
    'DATABASE_URL is still the example value.',
    'It points at a database that does not exist.',
    'Create a free database at https://neon.tech and replace the value in .env.local.'
  );
} else {
  let Client;
  try {
    ({ Client } = await import('pg'));
  } catch {
    warn('Could not load the `pg` package.', 'Run `npm ci` first, then re-run this check.');
  }

  if (Client) {
    const client = new Client({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 8000,
    });

    try {
      await client.connect();
      const expected = await readSchemaTables();
      const { rows } = await client.query(
        `select table_name from information_schema.tables where table_schema = 'public'`,
      );
      const present = new Set(rows.map((row) => row.table_name));
      const missing = expected.filter((table) => !present.has(table));

      if (missing.length === 0) {
        pass('Database connected, all tables present', `${expected.length} tables`);
      } else if (missing.length === expected.length) {
        fail(
          'Database connected, but the schema has not been applied.',
          `Missing every expected table (${expected.length}).`,
          'Run:  npx drizzle-kit push\n' +
            'Confirm the connection string is a DEVELOPMENT database first.'
        );
      } else {
        fail(
          'Database connected, but some tables are missing.',
          `Missing: ${missing.join(', ')}`,
          'Run:  npx drizzle-kit push'
        );
      }
    } catch (error) {
      const message = error?.message ?? String(error);
      const hint = /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message)
        ? 'The hostname could not be resolved. Check for a typo in the connection string.'
        : /ECONNREFUSED|ETIMEDOUT|timeout/i.test(message)
          ? 'The database did not accept the connection. Check that it is running and reachable, and that your IP is allowed.'
          : /password|authentication|28P01/i.test(message)
            ? 'Authentication failed. Check the username and password in the connection string.'
            : /database .* does not exist|3D000/i.test(message)
              ? 'The database name in the connection string does not exist.'
              : 'Check the connection string in .env.local.';
      fail('Could not connect to the database.', message.split('\n')[0], hint);
    } finally {
      await client.end().catch(() => {});
    }
  }
}

// --------------------------------------------------------------- 5. Spotify

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const redirectUri = process.env.SPOTIFY_REDIRECT_URI?.trim();

const spotifyProblems = [];
if (!clientId || isPlaceholder(clientId)) spotifyProblems.push('SPOTIFY_CLIENT_ID');
if (!clientSecret || isPlaceholder(clientSecret)) spotifyProblems.push('SPOTIFY_CLIENT_SECRET');

if (spotifyProblems.length > 0) {
  fail(
    `Spotify credentials missing: ${spotifyProblems.join(', ')}`,
    'Without these you cannot log in, and the chat, Discover, and Profile screens are behind the login.',
    'Create an app at https://developer.spotify.com/dashboard\n' +
      '  1. Copy its Client ID and Client Secret into .env.local\n' +
      '  2. Add this exact Redirect URI in the app settings:\n' +
      '     http://127.0.0.1:3000/api/auth/spotify/callback'
  );
} else {
  pass('Spotify credentials present');
}

if (!redirectUri) {
  fail(
    'SPOTIFY_REDIRECT_URI is not set.',
    'Spotify needs the exact callback URL used by the app.',
    'Set SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/auth/spotify/callback'
  );
} else if (redirectUri.includes('localhost')) {
  fail(
    'SPOTIFY_REDIRECT_URI uses "localhost".',
    'Spotify rejects localhost and requires an explicit loopback IP.',
    'Change it to http://127.0.0.1:3000/api/auth/spotify/callback and register the same value in the Spotify dashboard.'
  );
} else if (redirectUri.includes('example')) {
  fail('SPOTIFY_REDIRECT_URI is still an example value.', redirectUri);
} else if (!redirectUri.endsWith('/api/auth/spotify/callback')) {
  warn(
    'SPOTIFY_REDIRECT_URI does not end with /api/auth/spotify/callback.',
    `Current value: ${redirectUri}`,
    'It must match a redirect URI registered in the Spotify dashboard exactly.'
  );
} else {
  pass('Spotify redirect URI looks correct', redirectUri);
}

if (!spotifyProblems.length && clientId) {
  warn(
    'Spotify Development Mode may require Premium.',
    'Spotify has stated that Development Mode app owners need an active Premium subscription, and new apps may authorize only a small number of users.',
    'If login fails with a Premium or quota error, that is Spotify policy, not a MUSE bug.'
  );
}

// --------------------------------------------------------- 6. Encryption key

const encryptionKey = process.env.ENCRYPTION_KEY?.trim();
if (!encryptionKey) {
  fail(
    'ENCRYPTION_KEY is not set.',
    'MUSE encrypts stored Spotify tokens with it.',
    'Generate one:\n' +
      '  node -e "console.log(require(\'crypto\').randomBytes(16).toString(\'hex\'))"\n' +
      'then set ENCRYPTION_KEY in .env.local. Use 32+ characters.'
  );
} else if (normalize(encryptionKey).includes('replace_with')) {
  fail(
    'ENCRYPTION_KEY is still the example value.',
    'Every install would share the same key, so stored tokens are not meaningfully protected.',
    'Generate your own:\n' +
      '  node -e "console.log(require(\'crypto\').randomBytes(16).toString(\'hex\'))"'
  );
} else if (encryptionKey.length < 32) {
  fail(
    'ENCRYPTION_KEY is too short.',
    `It is ${encryptionKey.length} characters; the encryption code requires at least 32.`,
    'Generate a new one:\n' +
      '  node -e "console.log(require(\'crypto\').randomBytes(16).toString(\'hex\'))"'
  );
} else {
  pass('ENCRYPTION_KEY looks valid');
}

// ------------------------------------------------------------------ Report

const ICON = { ok: '  ✓', warn: '  !', fail: '  ✗' };
const COLOR = { ok: '\x1b[32m', warn: '\x1b[33m', fail: '\x1b[31m', reset: '\x1b[0m' };

console.log('\n  MUSE setup check\n');

for (const result of results) {
  console.log(`${COLOR[result.level]}${ICON[result.level]} ${result.title}${COLOR.reset}`);
  if (result.detail) console.log(`      ${result.detail}`);
  if (result.fix) {
    for (const line of result.fix.split('\n')) console.log(`      ${line}`);
  }
  console.log('');
}

const failures = results.filter((result) => result.level === 'fail').length;
const warnings = results.filter((result) => result.level === 'warn').length;

if (failures > 0) {
  console.log(
    `  ${failures} thing${failures === 1 ? '' : 's'} to fix before the AI features will work.\n` +
      '  Fix them above, then run: npm run check:setup\n'
  );
  process.exit(1);
}

if (warnings > 0) {
  console.log(`  Ready, with ${warnings} warning${warnings === 1 ? '' : 's'} worth reading.\n`);
} else {
  console.log('  Everything looks good.\n');
}

console.log('  Start the app:  npm run dev\n  Then open:      http://127.0.0.1:3000\n');
