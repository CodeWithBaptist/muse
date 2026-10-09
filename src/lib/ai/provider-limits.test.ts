import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Every completion must carry an output token cap, and the cap must come
 * from the deployment setting with a sane default and a hard ceiling.
 */

const openaiMock = vi.hoisted(() => ({
  create: vi.fn(),
}));

const budgetMock = vi.hoisted(() => ({
  recordAiTokens: vi.fn(async () => {}),
}));

vi.mock('./budget', () => ({
  recordAiTokens: budgetMock.recordAiTokens,
}));

vi.mock('openai', () => ({
  default: class OpenAI {
    chat = { completions: { create: openaiMock.create } };
  },
}));

import {
  chatCompletion,
  chatCompletionStream,
  DEFAULT_MAX_OUTPUT_TOKENS,
  getOutputTokenCap,
  HARD_MAX_OUTPUT_TOKENS,
  resolveMaxOutputTokens,
  structuredCompletion,
} from './provider';
import {
  CHAT_MESSAGE_MAX_LENGTH,
  ChatPostInputSchema,
} from '@/lib/validation/api-schemas';

const originalEnv = { ...process.env };

describe('output token cap', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-test-key-for-unit-tests';
    delete process.env.AI_MAX_OUTPUT_TOKENS;
    openaiMock.create.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults, reads the environment, and never exceeds the hard ceiling', () => {
    expect(getOutputTokenCap({})).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
    expect(getOutputTokenCap({ AI_MAX_OUTPUT_TOKENS: '600' })).toBe(600);
    expect(getOutputTokenCap({ AI_MAX_OUTPUT_TOKENS: 'lots' })).toBe(
      DEFAULT_MAX_OUTPUT_TOKENS,
    );
    expect(getOutputTokenCap({ AI_MAX_OUTPUT_TOKENS: '0' })).toBe(
      DEFAULT_MAX_OUTPUT_TOKENS,
    );
    expect(getOutputTokenCap({ AI_MAX_OUTPUT_TOKENS: '999999' })).toBe(
      HARD_MAX_OUTPUT_TOKENS,
    );
  });

  it('lets a call ask for less than the cap but never more', () => {
    process.env.AI_MAX_OUTPUT_TOKENS = '800';
    expect(resolveMaxOutputTokens()).toBe(800);
    expect(resolveMaxOutputTokens(300)).toBe(300);
    expect(resolveMaxOutputTokens(5000)).toBe(800);
    expect(resolveMaxOutputTokens(-1)).toBe(800);
  });

  it('sends max_completion_tokens on plain, streamed, and structured completions', async () => {
    process.env.AI_MAX_OUTPUT_TOKENS = '700';
    openaiMock.create.mockResolvedValueOnce({
      choices: [{ message: { content: 'hi' } }],
    });
    await chatCompletion([{ role: 'user', content: 'hello' }]);
    expect(openaiMock.create.mock.calls[0][0]).toMatchObject({
      max_completion_tokens: 700,
      stream: false,
    });

    openaiMock.create.mockResolvedValueOnce(
      (async function* () {
        yield { choices: [{ delta: { content: 'a' } }] };
      })(),
    );
    const chunks: string[] = [];
    for await (const delta of chatCompletionStream(
      [{ role: 'user', content: 'x' }],
      {
        maxOutputTokens: 200,
      },
    )) {
      chunks.push(delta);
    }
    expect(chunks).toEqual(['a']);
    expect(openaiMock.create.mock.calls[1][0]).toMatchObject({
      max_completion_tokens: 200,
      stream: true,
    });

    openaiMock.create.mockResolvedValueOnce({
      choices: [{ message: { content: '{"ok":true}' } }],
    });
    await expect(
      structuredCompletion('prompt', null, 'system', { maxOutputTokens: 9000 }),
    ).resolves.toEqual({
      ok: true,
    });
    expect(openaiMock.create.mock.calls[2][0]).toMatchObject({
      max_completion_tokens: 700,
      response_format: { type: 'json_object' },
    });
  });
});

describe('chat input length', () => {
  it('accepts up to the shared limit and rejects beyond it', () => {
    expect(CHAT_MESSAGE_MAX_LENGTH).toBe(500);
    expect(
      ChatPostInputSchema.safeParse({ content: 'a'.repeat(500) }).success,
    ).toBe(true);
    const tooLong = ChatPostInputSchema.safeParse({ content: 'a'.repeat(501) });
    expect(tooLong.success).toBe(false);
  });
});

describe('usage recording', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-test-key-for-unit-tests';
    openaiMock.create.mockReset();
    budgetMock.recordAiTokens.mockClear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('feeds total tokens from plain and streamed completions into the budget', async () => {
    openaiMock.create.mockResolvedValueOnce({
      choices: [{ message: { content: 'hi' } }],
      usage: { total_tokens: 57 },
    });
    await chatCompletion([{ role: 'user', content: 'hello' }]);
    expect(budgetMock.recordAiTokens).toHaveBeenCalledWith(57);

    openaiMock.create.mockResolvedValueOnce(
      (async function* () {
        yield { choices: [{ delta: { content: 'a' } }] };
        yield { choices: [], usage: { total_tokens: 91 } };
      })(),
    );
    for await (const delta of chatCompletionStream([
      { role: 'user', content: 'x' },
    ])) {
      void delta;
    }
    expect(openaiMock.create.mock.calls[1][0]).toMatchObject({
      stream_options: { include_usage: true },
    });
    expect(budgetMock.recordAiTokens).toHaveBeenCalledWith(91);
  });
});
