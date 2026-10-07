import { anthropicProvider, DEFAULT_ANTHROPIC_MODEL } from './providers/anthropic';
import { geminiProvider, DEFAULT_GEMINI_MODEL } from './providers/gemini';
import {
  AI_TEMPERATURE,
  CHAT_MAX_TOKENS,
  isZodSchema,
  parseJsonObject,
  STRUCTURED_MAX_TOKENS,
  type ChatProvider,
  type ChatProviderId,
  type Message,
} from './providers/shared';

export const AI_NOT_CONNECTED_CODE = 'AI_NOT_CONNECTED' as const;
export const AI_NOT_CONNECTED_MESSAGE = 'AI is not connected yet';

export type { ChatProviderId, Message };

/**
 * Claude is the default. Google AI Studio's free tier is supported as an
 * alternative so the app can run with no billing at all.
 */
export const DEFAULT_AI_MODEL = DEFAULT_ANTHROPIC_MODEL;
export { DEFAULT_ANTHROPIC_MODEL, DEFAULT_GEMINI_MODEL };

const PROVIDERS: Record<ChatProviderId, ChatProvider> = {
  anthropic: anthropicProvider,
  gemini: geminiProvider,
};

export class AINotConnectedError extends Error {
  readonly code = AI_NOT_CONNECTED_CODE;

  constructor(message = AI_NOT_CONNECTED_MESSAGE) {
    super(message);
    this.name = 'AINotConnectedError';
  }
}

/**
 * Resolve the active provider: an explicit AI_PROVIDER wins, otherwise use
 * whichever provider has a usable key, defaulting to Anthropic when neither is
 * configured so the "not connected" state stays predictable.
 */
export function getAIProviderId(): ChatProviderId {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit === 'anthropic' || explicit === 'gemini') {
    return explicit;
  }

  if (anthropicProvider.isConfigured()) return 'anthropic';
  if (geminiProvider.isConfigured()) return 'gemini';
  return 'anthropic';
}

export function getAIProvider(): ChatProvider {
  return PROVIDERS[getAIProviderId()];
}

export function getAIProviderLabel(): string {
  return getAIProvider().label;
}

/** Model for the active provider; ANTHROPIC_MODEL or GEMINI_MODEL override it. */
export function getAIModel(): string {
  return getAIProvider().getModel();
}

export function isAIConfigured(): boolean {
  return getAIProvider().isConfigured();
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
    if (
      typeof maybeMessage === 'string' &&
      /AI is not connected yet|ANTHROPIC_API_KEY|GEMINI_API_KEY/i.test(maybeMessage)
    ) {
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

function requireProvider(): ChatProvider {
  const provider = getAIProvider();
  if (!provider.isConfigured()) {
    throw new AINotConnectedError();
  }
  return provider;
}

/** Flatten a provider response to text, tolerating either provider's shape. */
export function extractTextContent(response: unknown): string {
  const active = getAIProvider();
  const text = active.extractText(response);
  if (text) return text;

  const fallback = active.id === 'anthropic' ? geminiProvider : anthropicProvider;
  return fallback.extractText(response);
}

export async function chatCompletion(messages: Message[]) {
  const provider = requireProvider();

  return provider.complete({
    messages,
    maxTokens: CHAT_MAX_TOKENS,
    temperature: AI_TEMPERATURE,
  });
}

export async function* chatCompletionStream(
  messages: Message[]
): AsyncGenerator<string, void, unknown> {
  const provider = requireProvider();

  yield* provider.stream({
    messages,
    maxTokens: CHAT_MAX_TOKENS,
    temperature: AI_TEMPERATURE,
  });
}

export async function structuredCompletion<T>(
  prompt: string,
  schema: unknown,
  systemPrompt = 'You are a helpful music assistant.'
): Promise<T> {
  const provider = requireProvider();

  const response = await provider.complete({
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: STRUCTURED_MAX_TOKENS,
    temperature: AI_TEMPERATURE,
    json: true,
  });

  const content = extractTextContent(response);
  if (!content.trim()) throw new Error('AI failed to generate content');

  const parsed = parseJsonObject(content);
  if (isZodSchema<T>(schema)) {
    return schema.parse(parsed);
  }
  return parsed as T;
}
