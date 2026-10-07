import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

const { generateContentMock, generateContentStreamMock, ctorMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
  generateContentStreamMock: vi.fn(),
  ctorMock: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class GoogleGenAIMock {
    models = {
      generateContent: generateContentMock,
      generateContentStream: generateContentStreamMock,
    };
    constructor(options: unknown) {
      ctorMock(options);
    }
  },
}));

import {
  DEFAULT_GEMINI_MODEL,
  chatCompletion,
  chatCompletionStream,
  getAIModel,
  getAIProviderId,
  isAIConfigured,
  structuredCompletion,
} from '@/lib/ai/provider';
import { DEFAULT_ANTHROPIC_MODEL } from './anthropic';

const ENV_KEYS = [
  'AI_PROVIDER',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'GEMINI_MODEL',
] as const;

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value !== undefined) process.env[key] = value;
    else delete process.env[key];
  }
}

describe('Gemini free-tier provider', () => {
  beforeEach(() => {
    generateContentMock.mockReset();
    generateContentStreamMock.mockReset();
    ctorMock.mockReset();
    for (const key of ENV_KEYS) delete process.env[key];
    process.env.GEMINI_API_KEY = 'AIza-test-key';
  });

  afterEach(restoreEnv);

  it('auto-selects Gemini when only a Gemini key is present, without AI_PROVIDER', () => {
    expect(getAIProviderId()).toBe('gemini');
    expect(isAIConfigured()).toBe(true);
  });

  it('prefers Anthropic when both keys are present, and honors an explicit AI_PROVIDER', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-test';
    expect(getAIProviderId()).toBe('anthropic');
    expect(getAIModel()).toBe(DEFAULT_ANTHROPIC_MODEL);

    process.env.AI_PROVIDER = 'gemini';
    expect(getAIProviderId()).toBe('gemini');
    expect(getAIModel()).toBe(DEFAULT_GEMINI_MODEL);
  });

  it('accepts GOOGLE_API_KEY as a fallback name for the Gemini key', () => {
    delete process.env.GEMINI_API_KEY;
    process.env.GOOGLE_API_KEY = 'AIza-google-key';
    expect(getAIProviderId()).toBe('gemini');
    expect(isAIConfigured()).toBe(true);
  });

  it('maps roles to user/model, sends the system prompt and maxOutputTokens, and asks for JSON', async () => {
    generateContentMock.mockResolvedValue({
      text: '{"sections":[{"title":"Deep cuts"}]}',
    });

    const schema = z.object({ sections: z.array(z.object({ title: z.string() })) });
    type Proposal = z.infer<typeof schema>;

    const result = await structuredCompletion<Proposal>('propose sections', schema, 'You are an editor.');

    expect(result.sections[0].title).toBe('Deep cuts');
    expect(generateContentMock).toHaveBeenCalledTimes(1);

    const args = generateContentMock.mock.calls[0][0];
    expect(args.model).toBe(DEFAULT_GEMINI_MODEL);
    expect(args.config.maxOutputTokens).toBeGreaterThan(0);
    expect(args.config.responseMimeType).toBe('application/json');
    expect(args.config.systemInstruction).toMatch(/You are an editor\./);
    expect(args.config.systemInstruction).toMatch(/valid JSON/);
    expect(args.contents).toEqual([{ role: 'user', parts: [{ text: 'propose sections' }] }]);
  });

  it('hoists system turns and maps assistant turns to the model role for chat', async () => {
    generateContentMock.mockResolvedValue({ text: 'Hello there' });

    const response = await chatCompletion([
      { role: 'system', content: 'You are MUSE.' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'Hey.' },
      { role: 'user', content: 'make me a playlist' },
    ]);

    const args = generateContentMock.mock.calls[0][0];
    expect(args.config.systemInstruction).toBe('You are MUSE.');
    expect(args.contents).toEqual([
      { role: 'user', parts: [{ text: 'hi' }] },
      { role: 'model', parts: [{ text: 'Hey.' }] },
      { role: 'user', parts: [{ text: 'make me a playlist' }] },
    ]);
    expect(response).toEqual({ text: 'Hello there' });
  });

  it('reads text from either the text getter or candidate parts, and streams chunk text', async () => {
    generateContentStreamMock.mockResolvedValue(
      (async function* () {
        yield { text: 'Hey' };
        yield { candidates: [{ content: { parts: [{ text: ' there' }] } }] };
        yield { candidates: [{ content: { parts: [{ inlineData: {} }] } }] };
      })()
    );

    const chunks: string[] = [];
    for await (const chunk of chatCompletionStream([{ role: 'user', content: 'hi' }])) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Hey', ' there']);
    expect(generateContentStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: DEFAULT_GEMINI_MODEL })
    );
  });

  it('rejects a response with no text and surfaces schema violations', async () => {
    generateContentMock.mockResolvedValue({ candidates: [{ finishReason: 'SAFETY' }] });
    await expect(structuredCompletion('anything', {})).rejects.toThrow(
      /AI failed to generate content/
    );

    generateContentMock.mockResolvedValue({ text: '{"sections":"not-an-array"}' });
    const schema = z.object({ sections: z.array(z.object({ title: z.string() })) });
    await expect(structuredCompletion('propose', schema)).rejects.toThrow();
  });

  it('honors GEMINI_MODEL and treats placeholder keys as not configured', () => {
    process.env.GEMINI_MODEL = 'gemini-2.5-flash';
    expect(getAIModel()).toBe('gemini-2.5-flash');
    delete process.env.GEMINI_MODEL;

    for (const placeholder of ['', '   ', 'add-later', 'your-gemini-api-key']) {
      process.env.GEMINI_API_KEY = placeholder;
      expect(isAIConfigured()).toBe(false);
    }

    process.env.GEMINI_API_KEY = 'AIza-real';
    expect(isAIConfigured()).toBe(true);
  });
});
