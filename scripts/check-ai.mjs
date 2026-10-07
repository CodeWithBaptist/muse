#!/usr/bin/env node
/**
 * One-command smoke test for MUSE's Claude connection.
 *
 *   npm run check:ai
 *
 * Verifies, against the real Anthropic API, the three things that actually
 * break in practice: the key is present and valid, the account can be billed,
 * and the configured model returns the JSON shape the recommendation,
 * discovery, and profile engines depend on.
 *
 * This makes exactly one small live API call (a few dozen tokens).
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import Anthropic, {
  AuthenticationError,
  BadRequestError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
} from '@anthropic-ai/sdk';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

dotenv.config({ path: [path.join(repoRoot, '.env.local'), path.join(repoRoot, '.env')], quiet: true });

const PLACEHOLDER_KEYS = new Set([
  'add-later',
  'add_later',
  'placeholder',
  'your-anthropic-api-key',
  'your_anthropic_api_key',
  'changeme',
  'none',
]);

/**
 * Read the default model straight out of the provider so this check can never
 * drift from what the app actually sends.
 */
async function resolveDefaultModel() {
  const source = await readFile(path.join(repoRoot, 'src/lib/ai/provider.ts'), 'utf8');
  const match = source.match(/DEFAULT_AI_MODEL\s*=\s*'([^']+)'/);
  return match?.[1] ?? 'claude-sonnet-5-5';
}

function fail(headline, ...details) {
  console.error(`\n  ✗ ${headline}\n`);
  for (const line of details) console.error(`    ${line}`);
  console.error('');
  process.exit(1);
}

function ok(headline, ...details) {
  console.log(`\n  ✓ ${headline}\n`);
  for (const line of details) console.log(`    ${line}`);
  console.log('');
}

const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

if (!apiKey) {
  fail(
    'ANTHROPIC_API_KEY is not set.',
    'Create .env.local in the repo root (it is git-ignored) and add:',
    '',
    '      ANTHROPIC_API_KEY=sk-ant-...',
    '',
    'Get a key at https://platform.claude.com/settings/keys',
    'The key is shown once, so copy it before closing the page.'
  );
}

if (PLACEHOLDER_KEYS.has(apiKey.toLowerCase()) || (apiKey.startsWith('<') && apiKey.endsWith('>'))) {
  fail(
    `ANTHROPIC_API_KEY is still the placeholder "${apiKey}".`,
    'Replace it with a real key from https://platform.claude.com/settings/keys'
  );
}

if (!apiKey.startsWith('sk-ant-')) {
  console.warn(
    `\n  ! This key does not start with "sk-ant-". Continuing anyway, in case it is a proxy or gateway key.\n`
  );
}

const model = process.env.ANTHROPIC_MODEL?.trim() || (await resolveDefaultModel());

console.log(`\n  Checking Claude connection — model ${model}`);

const anthropic = new Anthropic({ apiKey });
const startedAt = Date.now();

let response;
try {
  response = await anthropic.messages.create({
    model,
    max_tokens: 128,
    temperature: 0,
    system: 'You reply with a single valid JSON object and nothing else. No markdown, prose, or code fences.',
    messages: [
      {
        role: 'user',
        content: 'Return {"ok": true, "role": "music companion"} exactly, with no other keys.',
      },
    ],
  });
} catch (error) {
  const message = error?.error?.error?.message ?? error?.message ?? String(error);

  if (error instanceof AuthenticationError || error?.status === 401) {
    fail(
      'The API key was rejected (401).',
      'The key is invalid, revoked, or from a different workspace.',
      `Provider said: ${message}`,
      '',
      'Create a fresh key at https://platform.claude.com/settings/keys'
    );
  }

  if (error instanceof PermissionDeniedError || error?.status === 403) {
    fail('The key is not permitted to use this model (403).', `Provider said: ${message}`);
  }

  if (error instanceof NotFoundError || error?.status === 404) {
    fail(
      `The model "${model}" was not found (404).`,
      'ANTHROPIC_MODEL is probably set to a name that does not exist.',
      `Provider said: ${message}`,
      '',
      'Try one of: claude-sonnet-5-5, claude-sonnet-5, claude-haiku-4-5, claude-opus-5',
      'Or remove ANTHROPIC_MODEL to use the app default.'
    );
  }

  if (error instanceof RateLimitError || error?.status === 429) {
    fail('Rate limited (429).', 'The key works but the account is over its current limit.', `Provider said: ${message}`);
  }

  if (/credit balance|billing|purchase credits|insufficient|quota/i.test(message)) {
    fail(
      'The key is valid, but the account cannot be billed.',
      'A Claude Pro/Max subscription does NOT include API credits — they are separate products.',
      `Provider said: ${message}`,
      '',
      'Add a payment method and prepaid credits under Settings → Plans & Billing:',
      'https://platform.claude.com/settings/billing'
    );
  }

  if (error instanceof BadRequestError || error?.status === 400) {
    fail('The request was rejected (400).', `Provider said: ${message}`);
  }

  fail(
    'Could not reach the Anthropic API.',
    `Reason: ${message}`,
    '',
    'Check your network, VPN, or proxy. If you are offline, the rest of MUSE still runs;',
    'AI features show the "AI is not connected yet" state.'
  );
}

const elapsed = Date.now() - startedAt;
const text = (response.content ?? [])
  .map((block) => (block.type === 'text' ? block.text : ''))
  .join('')
  .trim();

let parsed;
try {
  parsed = JSON.parse(text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
} catch {
  fail(
    'Claude replied, but the response was not parseable JSON.',
    `Raw reply: ${text.slice(0, 200)}`,
    '',
    'MUSE depends on strict JSON for recommendations, Discover, and Profile Insights.'
  );
}

if (parsed?.ok !== true) {
  fail(
    'Claude replied with JSON, but not the requested shape.',
    `Parsed reply: ${JSON.stringify(parsed).slice(0, 200)}`
  );
}

const usage = response.usage ?? {};
ok(
  'Claude is connected and usable.',
  `model:    ${response.model ?? model}`,
  `latency:  ${elapsed} ms`,
  `tokens:   ${usage.input_tokens ?? '?'} in / ${usage.output_tokens ?? '?'} out`,
  `json:     ${JSON.stringify(parsed)}`,
  '',
  'Start the app with `npm run dev` and try a recommendation request in chat.'
);
