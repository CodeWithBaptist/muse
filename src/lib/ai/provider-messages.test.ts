import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock {
    messages = { create: createMock };
    constructor(_options: unknown) {}
  },
}));

import {
  DEFAULT_AI_MODEL,
  chatCompletion,
  chatCompletionStream,
  extractTextContent,
  getAIModel,
  isAIConfigured,
  structuredCompletion,
  toAnthropicRequest,
} from './provider';

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;
const ORIGINAL_MODEL = process.env.ANTHROPIC_MODEL;

describe('Anthropic Messages API provider', () => {
  beforeEach(() => {
    createMock.mockReset();
    process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-test';
  });

  afterEach(() => {
    if (ORIGINAL_KEY !== undefined) process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
    else delete process.env.ANTHROPIC_API_KEY;
    if (ORIGINAL_MODEL !== undefined) process.env.ANTHROPIC_MODEL = ORIGINAL_MODEL;
    else delete process.env.ANTHROPIC_MODEL;
  });

  it('hoists system turns, merges same-role turns, and drops empty or leading-assistant turns', () => {
    const request = toAnthropicRequest([
      { role: 'system', content: 'You are MUSE.' },
      { role: 'assistant', content: 'stale first turn from a trimmed history' },
      { role: 'user', content: 'Late night Afrobeats' },
      { role: 'user', content: '    ' },
      { role: 'assistant', content: 'Try these.' },
      { role: 'system', content: 'Never invent track URLs.' },
      { role: 'user', content: 'more like that' },
    ]);

    expect(request.system).toBe('You are MUSE.\n\nNever invent track URLs.');
    expect(request.messages).toEqual([
      { role: 'user', content: 'Late night Afrobeats' },
      { role: 'assistant', content: 'Try these.' },
      { role: 'user', content: 'more like that' },
    ]);
  });

  it('merges consecutive same-role turns created by dropping empty content', () => {
    const request = toAnthropicRequest([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: '' },
      { role: 'assistant', content: 'second' },
    ]);

    expect(request.system).toBeUndefined();
    expect(request.messages).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'second' },
    ]);
  });

  it('refuses a request with no conversation turns instead of sending an invalid body', () => {
    expect(() => toAnthropicRequest([{ role: 'system', content: 'only system' }])).toThrow(
      /At least one user or assistant message/
    );
  });

  it('sends max_tokens, model, system prompt, and normalized messages', async () => {
    createMock.mockResolvedValue({
      content: [
        { type: 'text', text: 'Hello ' },
        { type: 'tool_use', id: 'tool-1', name: 'x', input: {} },
        { type: 'text', text: 'there' },
      ],
    });

    const response = await chatCompletion([
      { role: 'system', content: 'You are MUSE.' },
      { role: 'user', content: 'hi' },
    ]);

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: DEFAULT_AI_MODEL,
        max_tokens: expect.any(Number),
        system: 'You are MUSE.',
        messages: [{ role: 'user', content: 'hi' }],
      })
    );
    expect(extractTextContent(response)).toBe('Hello there');
  });

  it('streams only text deltas from the event stream', async () => {
    createMock.mockResolvedValue(
      (async function* () {
        yield { type: 'message_start' };
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hey' } };
        yield { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{}' } };
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' there' } };
        yield { type: 'message_stop' };
      })()
    );

    const chunks: string[] = [];
    for await (const chunk of chatCompletionStream([{ role: 'user', content: 'hi' }])) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Hey', ' there']);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ stream: true, max_tokens: expect.any(Number) })
    );
  });

  it('parses fenced JSON, enforces the Zod schema, and rejects schema-invalid payloads', async () => {
    const schema = z.object({
      sections: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          searchQueries: z.array(z.string()),
        })
      ),
    });
    type DiscoverProposal = z.infer<typeof schema>;

    createMock.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '```json\n{"sections":[{"title":"Deep cuts","description":"Lesser known","searchQueries":["genre:soul"]}]}\n```',
        },
      ],
    });

    const parsed = await structuredCompletion<DiscoverProposal>('propose sections', schema);
    expect(parsed.sections[0].title).toBe('Deep cuts');
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringMatching(/valid JSON/),
        messages: [{ role: 'user', content: 'propose sections' }],
      })
    );

    createMock.mockResolvedValue({
      content: [{ type: 'text', text: '{"sections":"not-an-array"}' }],
    });
    await expect(structuredCompletion('propose sections', schema)).rejects.toThrow();

    createMock.mockResolvedValue({ content: [] });
    await expect(structuredCompletion('propose sections', schema)).rejects.toThrow(
      /AI failed to generate content/
    );
  });

  it('defaults the model and honors the ANTHROPIC_MODEL override', () => {
    delete process.env.ANTHROPIC_MODEL;
    expect(getAIModel()).toBe(DEFAULT_AI_MODEL);

    process.env.ANTHROPIC_MODEL = 'claude-haiku-4-5';
    expect(getAIModel()).toBe('claude-haiku-4-5');
  });

  it('treats placeholder Anthropic keys as not configured', () => {
    for (const placeholder of ['', '   ', 'add-later', 'your-anthropic-api-key', '<ANTHROPIC_API_KEY>']) {
      process.env.ANTHROPIC_API_KEY = placeholder;
      expect(isAIConfigured()).toBe(false);
    }

    process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-real';
    expect(isAIConfigured()).toBe(true);
  });
});
