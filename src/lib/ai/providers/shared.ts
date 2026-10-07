export type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type ChatProviderId = 'anthropic' | 'gemini';

export type ConversationTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export interface CompletionRequest {
  system?: string;
  messages: Message[];
  maxTokens: number;
  temperature: number;
  /** Ask the provider for machine-readable JSON output. */
  json?: boolean;
}

export interface ChatProvider {
  id: ChatProviderId;
  /** Human-readable provider name for status output and error messages. */
  label: string;
  isConfigured(): boolean;
  getModel(): string;
  /** Raw provider response, so callers can read usage metadata. */
  complete(request: CompletionRequest): Promise<unknown>;
  stream(request: CompletionRequest): AsyncGenerator<string, void, unknown>;
  /** Flatten a raw provider response to plain text. */
  extractText(response: unknown): string;
}

export const CHAT_MAX_TOKENS = 2048;
export const STRUCTURED_MAX_TOKENS = 4096;
export const AI_TEMPERATURE = 0.7;

export const JSON_ONLY_INSTRUCTION =
  'Respond with a single valid JSON object and nothing else. Do not include markdown, prose, or code fences.';

export const PLACEHOLDER_AI_KEYS = new Set([
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

/** Shared placeholder rules so every provider reports "not connected" identically. */
export function isUsableApiKey(raw: string | undefined): boolean {
  const value = raw?.trim();
  if (!value) return false;
  const normalized = value.toLowerCase();
  if (PLACEHOLDER_AI_KEYS.has(normalized)) return false;
  if (normalized.startsWith('<') && normalized.endsWith('>')) return false;
  return true;
}

/**
 * Every provider takes the system prompt separately and needs a valid turn
 * sequence, but the routes build one role-tagged list. Hoist system turns, drop
 * empty turns, merge consecutive same-role turns, and never start on an
 * assistant turn.
 */
export function normalizeConversation(messages: Message[]): {
  system?: string;
  turns: ConversationTurn[];
} {
  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join('\n\n');

  const turns: ConversationTurn[] = [];

  for (const message of messages) {
    if (message.role === 'system') continue;
    const content = message.content.trim();
    if (!content) continue;

    const previous = turns[turns.length - 1];
    if (previous && previous.role === message.role) {
      previous.content = `${previous.content}\n\n${content}`;
      continue;
    }

    turns.push({ role: message.role, content });
  }

  while (turns.length > 0 && turns[0].role === 'assistant') {
    turns.shift();
  }

  if (turns.length === 0) {
    throw new Error('At least one user or assistant message is required');
  }

  return system ? { system, turns } : { turns };
}

export interface ZodLikeSchema<T> {
  parse: (data: unknown) => T;
}

export function isZodSchema<T>(schema: unknown): schema is ZodLikeSchema<T> {
  return Boolean(
    schema &&
      typeof schema === 'object' &&
      typeof (schema as ZodLikeSchema<T>).parse === 'function'
  );
}

/** Parse a JSON object from a model response, tolerating stray prose or code fences. */
export function parseJsonObject(raw: string): unknown {
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
