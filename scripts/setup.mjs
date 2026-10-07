#!/usr/bin/env node
/**
 * Guided local setup for MUSE.
 *
 *   npm run setup
 *
 * Does the mechanical parts (install dependencies, create .env.local, apply the
 * database schema, verify everything) and stops at the parts only you can do
 * (pasting your own keys).
 *
 * Flags:
 *   --yes     do not pause for confirmation
 *   --skip-install   assume dependencies are already installed
 */
import { existsSync } from 'node:fs';
import { copyFile, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envLocalPath = path.join(repoRoot, '.env.local');
const envExamplePath = path.join(repoRoot, '.env.example');

const args = new Set(process.argv.slice(2));
const autoYes = args.has('--yes') || args.has('-y');
const skipInstall = args.has('--skip-install');
// Without an interactive terminal there is nobody to answer prompts, so never wait.
const interactive = Boolean(process.stdin.isTTY) && !autoYes;

const bold = (text) => `\x1b[1m${text}\x1b[0m`;
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const dim = (text) => `\x1b[2m${text}\x1b[0m`;

function step(number, total, text) {
  console.log(`\n${bold(`[${number}/${total}]`)} ${bold(text)}\n`);
}

function info(text = '') {
  console.log(`   ${text}`);
}

/** `npm` is `npm.cmd` on Windows, so always go through a shell. */
function run(command, { capture = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: repoRoot,
      shell: true,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      env: process.env,
    });

    let output = '';
    if (capture) {
      child.stdout?.on('data', (chunk) => {
        output += chunk;
      });
      child.stderr?.on('data', (chunk) => {
        output += chunk;
      });
    }

    child.on('error', (error) => resolve({ code: 1, output: `${output}\n${error.message}` }));
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

function ask(question) {
  if (!interactive) return Promise.resolve('');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function waitForEnter(message) {
  if (!interactive) return false;
  await ask(`${message} ${dim('(press Enter when done)')} `);
  return true;
}

/** Parse the .env.local contents into a name -> value map. */
function parseEnv(contents) {
  const values = new Map();
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values.set(match[1], match[2].trim());
  }
  return values;
}

/** True when a value is missing, empty, or one of the .env.example placeholders. */
function isUnfilled(value) {
  if (!value) return true; // an empty required value is not filled in
  const normalized = value.toLowerCase();
  return (
    normalized.includes('add-later') ||
    normalized.includes('your_') ||
    normalized.includes('your-') ||
    normalized.includes('example') ||
    normalized.includes('replace_with') ||
    normalized.includes('changeme')
  );
}

/**
 * MUSE needs one AI key, not a specific one, so the two provider keys are
 * checked together rather than individually.
 */
function aiKeyStatus(values) {
  const candidates = ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'ANTHROPIC_API_KEY'];
  const filled = candidates.filter((key) => !isUnfilled(values.get(key)));
  return { filled, satisfied: filled.length > 0 };
}

const TOTAL_STEPS = 6;

console.log(`\n${bold('MUSE local setup')}`);
console.log(dim('   Guide for a fresh clone. Safe to re-run at any time.'));

// ------------------------------------------------------------ 1. Node version

step(1, TOTAL_STEPS, 'Checking Node.js');

const nodeMajor = Number(process.versions.node.split('.')[0]);
info(`Node ${process.versions.node}`);

if (nodeMajor < 20) {
  console.log(`\n   ${red('Node 20 or newer is required.')}`);
  info('Install the LTS build from https://nodejs.org, reopen your terminal, and re-run.');
  process.exit(1);
}
info(green('OK'));

// ----------------------------------------------------------- 2. Dependencies

step(2, TOTAL_STEPS, 'Installing dependencies');

const nodeModulesPath = path.join(repoRoot, 'node_modules');

if (skipInstall) {
  info('Skipped (--skip-install).');
} else if (existsSync(nodeModulesPath)) {
  info('node_modules already exists — skipping.');
  info(dim('Re-run with `npm ci` if dependencies look stale.'));
} else {
  info('This downloads about 950 MB and takes a few minutes on first run.');
  info(dim('Most of it is Next.js. It is a one-time cost.'));
  console.log();
  const install = await run('npm ci');
  if (install.code !== 0) {
    console.log(`\n   ${red('npm ci failed.')}`);
    info('The error above usually names the cause. Common fixes:');
    info('  - Check you are online.');
    info('  - On Windows, if PowerShell blocked the script, run:');
    info('      Set-ExecutionPolicy -Scope CurrentUser RemoteSigned');
    process.exit(1);
  }
  info(green('Dependencies installed.'));
}

// ------------------------------------------------------------- 3. .env.local

step(3, TOTAL_STEPS, 'Configuration file');

if (!existsSync(envLocalPath)) {
  if (!existsSync(envExamplePath)) {
    console.log(`   ${red('.env.example is missing — the clone looks incomplete.')}`);
    process.exit(1);
  }
  await copyFile(envExamplePath, envLocalPath);
  info(`Created ${bold('.env.local')} from .env.example.`);
} else {
  info('.env.local already exists — leaving it alone.');
}

const needed = [
  ['DATABASE_URL', 'Free PostgreSQL.', 'https://neon.tech'],
  ['SPOTIFY_CLIENT_ID', 'From your Spotify app.', 'https://developer.spotify.com/dashboard'],
  ['SPOTIFY_CLIENT_SECRET', 'From your Spotify app.', 'https://developer.spotify.com/dashboard'],
  ['ENCRYPTION_KEY', 'Generate with the command below.', null],
];

let values = parseEnv(await readFile(envLocalPath, 'utf8'));

function missingKeys(current) {
  const missing = needed.filter(([key]) => isUnfilled(current.get(key))).map(([key]) => key);
  if (!aiKeyStatus(current).satisfied) missing.push('AI key');
  return missing;
}

let unfilled = missingKeys(values);

if (unfilled.length > 0) {
  console.log();
  info(`These still need real values in ${bold('.env.local')}:`);
  console.log();
  for (const [key, purpose, url] of needed) {
    const marker = isUnfilled(values.get(key)) ? red('•') : green('✓');
    console.log(`   ${marker} ${bold(key)}`);
    console.log(`       ${purpose}${url ? ` ${dim(url)}` : ''}`);
  }
  const ai = aiKeyStatus(values);
  console.log(
    `   ${ai.satisfied ? green('✓') : red('•')} ${bold('An AI key')} ${dim('(either one)')}`,
  );
  console.log('       Free, no card: GEMINI_API_KEY  https://aistudio.google.com/apikey');
  console.log('       Paid:          ANTHROPIC_API_KEY  https://platform.claude.com/settings/keys');
  console.log();
  info(`File location: ${dim(envLocalPath)}`);
  console.log();
  info(yellow('Windows tip: Notepad saves files as ".env.local.txt".'));
  info(yellow('Use VS Code, or turn on file extensions in Explorer and rename it.'));
  console.log();
  info('Generate the encryption key with:');
  info(dim(`   node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`));
  console.log();
  info(`${yellow('SPOTIFY_REDIRECT_URI')} must be exactly:`);
  info(dim('   http://127.0.0.1:3000/api/auth/spotify/callback'));
  info('and the same value must be registered in your Spotify app settings.');

  if (interactive) {
    await waitForEnter('\n   Fill those in, save the file, then');
    values = parseEnv(await readFile(envLocalPath, 'utf8'));
    unfilled = missingKeys(values);
    if (unfilled.length > 0) {
      console.log(`\n   ${red(`Still unfilled: ${unfilled.join(', ')}`)}`);
      info('Re-run `npm run setup` when they are set.');
      process.exit(1);
    }
    info(green('All values filled in.'));
  } else {
    console.log();
    info('Fill those in, then re-run: npm run setup');
    process.exit(1);
  }
} else {
  info(green('All required values are filled in.'));
}

// --------------------------------------------------------------- 4. Verify

step(4, TOTAL_STEPS, 'Verifying configuration');
info('Running the setup check (this makes one live AI call).');
console.log();

const check = await run('npm run check:setup', { capture: true });
// Print it ourselves so the output is captured for the next step too,
// instead of running the whole check (and the live AI call) twice.
process.stdout.write(check.output);
const checkPassed = check.code === 0;

if (!checkPassed) {
  console.log(`\n   ${red('The check found problems — see above.')}`);
  info('Fix them, then re-run: npm run setup');
  process.exit(1);
}

info(green('Configuration verified.'));

// ------------------------------------------------------------ 5. Database

step(5, TOTAL_STEPS, 'Database schema');

const schemaMissing = /schema has not been applied|some tables are missing/i.test(check.output);

if (!schemaMissing) {
  info('Schema already applied — nothing to do.');
} else {
  info('The database is reachable but the tables do not exist yet.');
  info(dim('This creates them from src/db/schema.ts using drizzle-kit push.'));
  console.log();

  const answer = autoYes ? 'y' : await ask('   Apply the schema now? (y/n) ');

  if (answer.toLowerCase().startsWith('y')) {
    const push = await run('npx drizzle-kit push');
    if (push.code !== 0) {
      console.log(`\n   ${red('drizzle-kit push failed.')}`);
      info('Check that DATABASE_URL points at the database you intend to change,');
      info('then run it yourself to see the full output:  npx drizzle-kit push');
      process.exit(1);
    }
    info(green('Schema applied.'));
  } else {
    info('Skipped. Run `npx drizzle-kit push` when ready.');
    process.exit(0);
  }
}

// ---------------------------------------------------------------- 6. Done

step(6, TOTAL_STEPS, 'Ready');

console.log(`   ${green(bold('Setup complete.'))}\n`);
info('Start the app:');
console.log(`\n   ${bold('npm run dev')}\n`);
info('Then open:');
console.log(`\n   ${bold('http://127.0.0.1:3000')}\n`);
info(dim('Use 127.0.0.1, not localhost — Spotify rejects localhost.'));
console.log();
info(yellow('Reminder: signing in requires a Spotify account.'));
info(yellow('Spotify may also require Premium for Development Mode apps.'));
info('Until you sign in, chat and Discover are reachable only after login.');
console.log();
