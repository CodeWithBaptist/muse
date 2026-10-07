#!/usr/bin/env node
/**
 * One-command local development for MUSE.
 *
 *   npm run dev:stack
 *   npm run dev:stack -- --hostname 0.0.0.0 --port 3000
 *
 * What it does, in order:
 *
 *   1. Reads DATABASE_URL from .env.local (then .env), the same precedence
 *      Next.js and drizzle.config.ts use.
 *   2. If DATABASE_URL points at a loopback host and Docker Compose is
 *      available, starts the `db` service from docker-compose.yml.
 *      Without Docker it expects you to run PostgreSQL yourself and says so.
 *   3. Waits until PostgreSQL accepts connections.
 *   4. For loopback databases only, applies the Drizzle schema with
 *      `drizzle-kit push`. Remote databases are never touched automatically.
 *   5. Starts `next dev`, forwarding any extra arguments.
 *
 * It adds no dependencies: `pg` and `dotenv` are already part of the project.
 * Nothing here prints secrets. DATABASE_URL is only ever shown with the
 * password removed.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const drizzleKitBin = path.join(root, 'node_modules', 'drizzle-kit', 'bin.cjs');

const DB_WAIT_SECONDS = Number(process.env.MUSE_DB_WAIT_SECONDS ?? 30);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function log(message) {
  process.stdout.write(`[muse] ${message}\n`);
}

function fail(message, hints = []) {
  process.stderr.write(`[muse] ${message}\n`);
  for (const hint of hints) process.stderr.write(`[muse]   ${hint}\n`);
  process.exit(1);
}

function redact(url) {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '****';
    return parsed.toString();
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

function parseDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    if (!/^postgres(ql)?:$/.test(parsed.protocol)) return null;
    return {
      host: parsed.hostname,
      port: parsed.port || '5432',
      loopback: LOOPBACK_HOSTS.has(parsed.hostname),
    };
  } catch {
    return null;
  }
}

function hasDockerCompose() {
  const result = spawnSync('docker', ['compose', 'version'], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
  return result.status === 0;
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    });
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

async function waitForDatabase(url) {
  const deadline = Date.now() + DB_WAIT_SECONDS * 1000;
  let lastError = 'unknown error';

  while (Date.now() < deadline) {
    const client = new pg.Client({
      connectionString: url,
      connectionTimeoutMillis: 2000,
    });
    try {
      await client.connect();
      await client.query('select 1');
      await client.end();
      return { ok: true };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await client.end().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return { ok: false, lastError };
}

async function main() {
  for (const bin of [nextBin, drizzleKitBin]) {
    if (!existsSync(bin)) {
      fail('Dependencies are not installed.', ['Run: npm ci']);
    }
  }

  // .env.local wins over .env, matching Next.js. Values already present in the
  // shell environment win over both.
  loadEnv({
    path: [path.join(root, '.env.local'), path.join(root, '.env')],
    quiet: true,
  });

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    fail('DATABASE_URL is not set.', [
      'Copy .env.example to .env.local and keep the local Docker value:',
      'DATABASE_URL=postgresql://muse:muse@127.0.0.1:5432/muse',
      'To start the app without a database, run: npm run dev',
    ]);
  }

  const target = parseDatabaseUrl(databaseUrl);
  if (!target) {
    fail('DATABASE_URL is not a valid postgresql:// connection string.');
  }

  log(`Database: ${redact(databaseUrl)}`);

  if (target.loopback) {
    if (hasDockerCompose()) {
      log('Starting the PostgreSQL container (docker compose up -d db)');
      const env = { ...process.env };
      // Keep docker-compose.yml and DATABASE_URL on the same host port.
      if (!env.MUSE_DB_PORT) env.MUSE_DB_PORT = target.port;
      const code = await run('docker', ['compose', 'up', '-d', 'db'], { env });
      if (code !== 0) {
        fail('docker compose could not start the database.', [
          'Check that Docker is running, then try: npm run db:up',
        ]);
      }
    } else {
      log(
        `Docker Compose is not available, so expecting PostgreSQL to already be listening on ${target.host}:${target.port}.`,
      );
    }
  } else {
    log(
      'Remote database detected. It will not be started or migrated automatically.',
    );
  }

  log(`Waiting for PostgreSQL (up to ${DB_WAIT_SECONDS}s)`);
  const ready = await waitForDatabase(databaseUrl);
  if (!ready.ok) {
    fail(`PostgreSQL did not become reachable: ${ready.lastError}`, [
      target.loopback
        ? 'Start it with: npm run db:up (requires Docker), or run PostgreSQL locally on that port.'
        : 'Check the host, port, credentials, and network access for the remote database.',
      'To start the app without a database, run: npm run dev',
    ]);
  }
  log('PostgreSQL is ready');

  if (target.loopback) {
    log('Applying the Drizzle schema (drizzle-kit push)');
    // drizzle.config.ts loads dotenv itself; keep its banner out of the output.
    const code = await run(process.execPath, [drizzleKitBin, 'push'], {
      env: { ...process.env, DOTENV_CONFIG_QUIET: 'true' },
    });
    if (code !== 0) {
      fail('drizzle-kit push did not complete.', [
        'Review the output above, then retry with: npm run db:push',
      ]);
    }
  } else {
    log(
      'Skipping schema push for a remote database. Apply it deliberately with: npm run db:push',
    );
  }

  const nextArgs = process.argv.slice(2);
  log(
    `Starting Next.js (next dev${nextArgs.length ? ` ${nextArgs.join(' ')}` : ''})`,
  );
  const next = spawn(process.execPath, [nextBin, 'dev', ...nextArgs], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });

  const forward = (signal) => {
    if (!next.killed) next.kill(signal);
  };
  process.on('SIGINT', () => forward('SIGINT'));
  process.on('SIGTERM', () => forward('SIGTERM'));

  next.on('exit', (code, signal) => {
    if (signal) process.exit(0);
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
