#!/usr/bin/env node
/**
 * One-command smoke test for MUSE's AI connection.
 *
 *   npm run check:ai
 *
 * Verifies, against the real provider API, the things that actually break in
 * practice: the key is present and valid, the account can be billed (or is on a
 * free tier), and the configured model returns the JSON shape the
 * recommendation, discovery, and profile engines depend on.
 *
 * This makes exactly one small live API call (a few dozen tokens).
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

dotenv.config({
  path: [path.join(repoRoot, '.env.local'), path.join(repoRoot, '.env')],
  quiet: true,
});

const PLACEHOLDER_KEYS = new Set([
  'add-later',
  'add_later',
  'placeholder',
  'your-anthropic-api-key',
  'your_anthropic_api_key',
  'your-gemini-api-key',
  'your_gemini_api_key',
  'changeme',
  'none',
]);

/** Mirrors isUsableApiKey() in src/lib/ai/providers/shared.ts. */
function isUsableApiKey(raw) {
  const value = raw?.trim();
  if (!value) return false;
  const normalized = value.toLowerCase();
  if (PLACEHOLDER_KEYS.has(normalized)) return false;
  if (normalized.startsWith('<') && normalized.endsWith('>')) return false;
  return true;
}

/**
 * Read the default model straight out of the provider modules so this check can
 * never drift from what the app actually sends.
 */
async function readDefaultModel(file, constant) {
  const source = await readFile(path.join(repoRoot, file), 'utf8');
  const match = source.match(new RegExp(`${constant}\\s*=\\s*'([^']+)'`));
  return match?.[1];
}

const anthropicKey = process.env.ANTHROPIC_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();

/** Mirrors getAIProviderId() in src/lib/ai/provider.ts. */
function resolveProviderId() {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit === 'anthropic' || explicit === 'gemini') return explicit;
  if (isUsableApiKey(anthropicKey)) return 'anthropic';
  if (isUsableApiKey(geminiKey)) return 'gemini';
  return 'anthropic';
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

const providerId = resolveProviderId();

const KEY_HINT = {
  anthropic: [
    'Get a key at https://platform.claude.com/settings/keys',
    'The key is shown once, so copy it before closing the page.',
    'A Claude Pro/Max subscription does NOT include API credits.',
  ],
  gemini: [
    'Get a free key at https://aistudio.google.com/apikey (no credit card).',
    'The free tier is rate limited; Google may use free-tier data to improve its models.',
  ],
};

const apiKey = providerId === 'anthropic' ? anthropicKey : geminiKey;
const keyVar = providerId === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY';

if (!isUsableApiKey(apiKey)) {
  const isNothingConfigured = !isUsableApiKey(anthropicKey) && !isUsableApiKey(geminiKey);

  if (isNothingConfigured) {
    fail(
      'No AI provider is configured yet.',
      'Create .env.local in the repo root (it is git-ignored) and pick one:',
      '',
      '  Free, no credit card — Google AI Studio:',
      '      GEMINI_API_KEY=AIza...        # https://aistudio.google.com/apikey',
      '',
      '  Paid — Anthropic Claude:',
      '      ANTHROPIC_API_KEY=sk-ant-...  # https://platform.claude.com/settings/keys',
      '',
      'MUSE picks the provider automatically from whichever key is set.',
      'GEMINI_API_KEY is the zero-cost option: the free tier is rate limited,',
      'and Google may use free-tier data to improve its models, so treat it as',
      'development-only.'
    );
  }

  fail(
    `${keyVar} is set but unusable${apiKey?.trim() ? ` (currently "${apiKey.trim()}")` : ''}.`,
    'Placeholders like "add-later" do not count as configured.',
    '',
    `      ${keyVar}=${providerId === 'anthropic' ? 'sk-ant-...' : 'AIza...'}`,
    '',
    ...KEY_HINT[providerId]
  );
}

/** One small call that asks for JSON, mirroring the structured engine calls. */
const PROMPT = 'Return {"ok": true, "role": "music companion"} exactly, with no other keys.';
const SYSTEM =
  'You reply with a single valid JSON object and nothing else. No markdown, prose, or code fences.';

let describeCall;
try {
  describeCall = providerId === 'anthropic' ? await runAnthropic() : await runGemini();
} catch (error) {
  handleProviderError(error, providerId);
}

const { text, model, latencyMs, usage } = describeCall;

let parsed;
try {
  parsed = JSON.parse(text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
} catch {
  fail(
    'The model replied, but the response was not parseable JSON.',
    `Raw reply: ${String(text).slice(0, 200)}`,
    '',
    'MUSE depends on strict JSON for recommendations, Discover, and Profile Insights.'
  );
}

if (parsed?.ok !== true) {
  fail(
    'The model replied with JSON, but not the requested shape.',
    `Parsed reply: ${JSON.stringify(parsed).slice(0, 200)}`
  );
}

ok(
  'AI is connected and usable.',
  `provider: ${providerId}`,
  `model:    ${model}`,
  `latency:  ${latencyMs} ms`,
  `tokens:   ${usage}`,
  `json:     ${JSON.stringify(parsed)}`,
  '',
  'Start the app with `npm run dev` and try a recommendation request in chat.'
);

async function runAnthropic() {
  const { default: Anthropic, ...errors } = await import('@anthropic-ai/sdk');
  const { AuthenticationError, PermissionDeniedError, NotFoundError, RateLimitError, BadRequestError } =
    errors;

  const model = process.env.ANTHROPIC_MODEL?.trim() ||
    (await readDefaultModel('src/lib/ai/providers/anthropic.ts', 'DEFAULT_ANTHROPIC_MODEL'));

  console.log(`\n  Checking Claude connection — ${model}`);

  const client = new Anthropic({ apiKey: apiKey.trim() });
  const startedAt = Date.now();

  let response;
  try {
    response = await client.messages.create({
      model,
      max_tokens: 128,
      temperature: 0,
      system: SYSTEM,
      messages: [{ role: 'user', content: PROMPT }],
    });
  } catch (error) {
    error.providerErrors = { AuthenticationError, PermissionDeniedError, NotFoundError, RateLimitError, BadRequestError };
    error.model = model;
    throw error;
  }

  return {
    text: (response.content ?? []).map((block) => (block.type === 'text' ? block.text : '')).join('').trim(),
    model: response.model ?? model,
    latencyMs: Date.now() - startedAt,
    usage: `${response.usage?.input_tokens ?? '?'} in / ${response.usage?.output_tokens ?? '?'} out`,
  };
}

async function runGemini() {
  const { GoogleGenAI } = await import('@google/genai');

  const model = process.env.GEMINI_MODEL?.trim() ||
    (await readDefaultModel('src/lib/ai/providers/gemini.ts', 'DEFAULT_GEMINI_MODEL'));

  console.log(`\n  Checking Gemini connection — ${model}`);

  const client = new GoogleGenAI({ apiKey: apiKey.trim() });
  const startedAt = Date.now();

  const response = await client.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: PROMPT }] }],
    config: {
      systemInstruction: SYSTEM,
      temperature: 0,
      maxOutputTokens: 256,
      responseMimeType: 'application/json',
    },
  });

  const usage = response.usageMetadata ?? {};
  return {
    text: (response.text ?? '').trim(),
    model: response.modelVersion ?? model,
    latencyMs: Date.now() - startedAt,
    usage: `${usage.promptTokenCount ?? '?'} in / ${usage.candidatesTokenCount ?? '?'} out`,
  };
}

function handleProviderError(error, id) {
  const message = error?.error?.error?.message ?? error?.message ?? String(error);
  const status = error?.status ?? error?.code;
  const model = error?.model ?? 'the configured model';

  if (id === 'anthropic') {
    const { AuthenticationError, PermissionDeniedError, NotFoundError, RateLimitError, BadRequestError } =
      error?.providerErrors ?? {};

    if (error instanceof AuthenticationError || status === 401) {
      fail('The API key was rejected (401).', 'The key is invalid, revoked, or from a different workspace.', `Provider said: ${message}`, '', ...KEY_HINT.anthropic);
    }
    if (error instanceof PermissionDeniedError || status === 403) {
      fail('The key is not permitted to use this model (403).', `Provider said: ${message}`);
    }
    if (error instanceof NotFoundError || status === 404) {
      fail(
        `The model "${model}" was not found (404).`,
        'ANTHROPIC_MODEL is probably set to a name that does not exist.',
        `Provider said: ${message}`,
        '',
        'Try one of: claude-sonnet-5-5, claude-sonnet-5, claude-haiku-4-5, claude-opus-5',
        'Or remove ANTHROPIC_MODEL to use the app default.'
      );
    }
    if (error instanceof RateLimitError || status === 429) {
      fail('Rate limited (429).', 'The key works but the account is over its current limit.', `Provider said: ${message}`);
    }
    if (error instanceof BadRequestError || status === 400) {
      fail('The request was rejected (400).', `Provider said: ${message}`);
    }
    if (/credit balance|billing|purchase credits|insufficient|quota/i.test(message)) {
      fail(
        'The key is valid, but the account cannot be billed.',
        'A Claude Pro/Max subscription does NOT include API credits — they are separate products.',
        `Provider said: ${message}`,
        '',
        'Add a payment method and prepaid credits under Settings → Plans & Billing:',
        'https://platform.claude.com/settings/billing',
        '',
        'Or switch to the free tier by setting GEMINI_API_KEY and AI_PROVIDER=gemini.'
      );
    }
  }

  if (id === 'gemini') {
    if (status === 400 || /API key not valid|INVALID_ARGUMENT/i.test(message)) {
      fail(
        'Google rejected the request (400).',
        'Usually this means the API key is invalid, or the Generative Language API is not enabled.',
        `Provider said: ${message}`,
        '',
        ...KEY_HINT.gemini
      );
    }
    if (status === 403 || /PERMISSION_DENIED|not supported for|free tier/i.test(message)) {
      fail(
        'The key is not permitted to use this model (403).',
        'Free-tier keys cannot call every model. Flash models are the free ones.',
        `Provider said: ${message}`,
        '',
        'Try: gemini-flash-latest, gemini-2.5-flash, gemini-flash-lite-latest',
        'in GEMINI_MODEL, or remove GEMINI_MODEL to use the default.'
      );
    }
    if (status === 404 || /NOT_FOUND|not found/i.test(message)) {
      fail(
        `The model "${model}" was not found (404).`,
        'GEMINI_MODEL is probably set to a name that does not exist.',
        `Provider said: ${message}`,
        '',
        'Try: gemini-flash-latest, gemini-2.5-flash, gemini-flash-lite-latest',
        'Or remove GEMINI_MODEL to use the app default.'
      );
    }
    if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(message)) {
      fail(
        'Rate limited or out of free-tier quota (429).',
        'This is a limits problem, not a key problem. The free tier allows roughly',
        '15 requests/minute and a few hundred per day per model.',
        `Provider said: ${message}`,
        '',
        'Wait for the quota to reset, or set a lighter GEMINI_MODEL such as gemini-flash-lite-latest.'
      );
    }
  }

  fail(
    `Could not reach the ${id === 'gemini' ? 'Gemini' : 'Anthropic'} API.`,
    `Reason: ${message}`,
    '',
    'Check your network, VPN, or proxy. If you are offline, the rest of MUSE still runs;',
    'AI features show the "AI is not connected yet" state.'
  );
}
