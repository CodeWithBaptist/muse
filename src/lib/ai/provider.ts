import Anthropic from '@anthropic-ai/sdk';
import type {
  Message as AnthropicMessage,
  MessageParam,
} from '@anthropic-ai/sdk/resources/messages';

export const AI_NOT_CONNECTED_CODE = 'AI_NOT_CONNECTED' as const;
export const AI_NOT_CONNECTED_MESSAGE = 'AI is not connected yet';

/** Claude model used for chat, recommendations, discovery, and profile insights. */
export const DEFAULT_AI_MODEL = 'claude-sonnet-5-5';

const CHAT_MAX_TOKENS = 2048;
const STRUCTURED_MAX_TOKENS = 4096;
const AI_TEMPERATURE = 0.7;

const JSON_ONLY_INSTRUCTION =
  'Respond with a single valid JSON object and nothing else. Do not include markdown, prose, or code fences.';

const PLACEHOLDER_AI_KEYS = new Set([
  'add-later',
  'add_later',
  'placeholder',
  'your-anthropic-api-key',
  'your_anthropic_api_key',
  'changeme',
  'none',
]);

export class AINotConnectedError extends Error {
  readonly code = AI_NOT_CONNECTED_CODE;

  constructor(message = AI_NOT_CONNECTED_MESSAGE) {
    super(message);
    this.name = 'AINotConnectedError';
  }
}

/** Override the model with ANTHROPIC_MODEL (for example claude-haiku-4-5 for cheaper classification). */
export function getAIModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_AI_MODEL;
}

export function isAIConfigured(): boolean {
  const raw = process.env.ANTHROPIC_API_KEY?.trim();
  if (!raw) return false;
  const normalized = raw.toLowerCase();
  if (PLACEHOLDER_AI_KEYS.has(normalized)) return false;
  if (normalized.startsWith('<') && normalized.endsWith('>')) return false;
  return true;
}

export function isAINotConnectedError(error: unknown): boolean {
  if (error instanceof AINotConnectedError) {
    return true;
  }
  if (error && typeof error === 'object') {
    const maybeCode = (error as { code?: unknown }).code;
    const maybeName = (error as { name?: unknown }).name;
    const maybeMessage = (error as { message?: unknown }).message;
    if (maybeCode === AI_NOT_CONNECTED_CODE || maybeName === 'AINotConnectedError') {
      return true;
    }
    if (typeof maybeMessage === 'string' && /AI is not connected yet|ANTHROPIC_API_KEY/i.test(maybeMessage)) {
      return true;
    }
  }
  return false;
}

export function sanitizePromptInput(input: string, maxLength = 1000): string {
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .replace(/<\|im_start\|>|<\|im_end\|>|<\|endoftext\|>/gi, '')
    .replace(/<\/?(system|user_message|spotify_context|user_preferences|developer|assistant)>/gi, '')
    .replace(/\b(ignore\s+(all\s+)?(previous|prior|above)\s+instructions)\b/gi, '[filtered]')
    .trim()
    .slice(0, maxLength);
}

let _anthropic: Anthropic | null = null;
let _cachedKey: string | null = null;

function getAnthropic(): Anthropic {
  if (!isAIConfigured()) {
    _anthropic = null;
    _cachedKey = null;
    throw new AINotConnectedError();
  }

  const apiKey = process.env.ANTHROPIC_API_KEY!.trim();
  if (!_anthropic || _cachedKey !== apiKey) {
    _anthropic = new Anthropic({ apiKey });
    _cachedKey = apiKey;
  }
  return _anthropic;
}

export type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

/**
 * The Messages API takes the system prompt as a top-level parameter and requires
 * at least one user/assistant turn. Normalize the role-tagged message list the
 * routes already build: hoist system turns, drop empty turns, merge consecutive
 * same-role turns, and never start on an assistant turn.
 */
export function toAnthropicRequest(messages: Message[]): {
  system?: string;
  messages: MessageParam[];
} {
  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join('\n\n');

  const conversation: MessageParam[] = [];

  for (const message of messages) {
    if (message.role === 'system') continue;
    const content = message.content.trim();
    if (!content) continue;

    const previous = conversation[conversation.length - 1];
    if (previous && previous.role === message.role) {
      previous.content = `${previous.content as string}\n\n${content}`;
      continue;
    }

    conversation.push({ role: message.role, content });
  }

  while (conversation.length > 0 && conversation[0].role === 'assistant') {
    conversation.shift();
  }

  if (conversation.length === 0) {
    throw new Error('At least one user or assistant message is required');
  }

  return system ? { system, messages: conversation } : { messages: conversation };
}

/** Concatenate the text blocks of a response, ignoring non-text blocks. */
export function extractTextContent(message: AnthropicMessage): string {
  if (!message || !Array.isArray(message.content)) return '';
  return message.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('');
}

interface ZodLikeSchema<T> {
  parse: (data: unknown) => T;
}

function isZodSchema<T>(schema: unknown): schema is ZodLikeSchema<T> {
  return Boolean(
    schema &&
      typeof schema === 'object' &&
      typeof (schema as ZodLikeSchema<T>).parse === 'function'
  );
}

/** Parse a JSON object from a model response, tolerating stray prose or code fences. */
function parseJsonObject(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('AI failed to generate content');
  }
}

export async function chatCompletion(messages: Message[]) {
  const anthropic = getAnthropic();
  const request = toAnthropicRequest(messages);

  return anthropic.messages.create({
    model: getAIModel(),
    max_tokens: CHAT_MAX_TOKENS,
    temperature: AI_TEMPERATURE,
    ...request,
  });
}

export async function* chatCompletionStream(
  messages: Message[]
): AsyncGenerator<string, void, unknown> {
  const anthropic = getAnthropic();
  const request = toAnthropicRequest(messages);

  const stream = await anthropic.messages.create({
    model: getAIModel(),
    max_tokens: CHAT_MAX_TOKENS,
    temperature: AI_TEMPERATURE,
    ...request,
    stream: true,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

export async function structuredCompletion<T>(
  prompt: string,
  schema: unknown,
  systemPrompt = 'You are a helpful music assistant.'
): Promise<T> {
  const anthropic = getAnthropic();

  const response = await anthropic.messages.create({
    model: getAIModel(),
    max_tokens: STRUCTURED_MAX_TOKENS,
    system: `${systemPrompt}\n\n${JSON_ONLY_INSTRUCTION}`,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = extractTextContent(response);
  if (!content.trim()) throw new Error('AI failed to generate content');

  const parsed = parseJsonObject(content);
  if (isZodSchema<T>(schema)) {
    return schema.parse(parsed);
  }
  return parsed as T;
}
