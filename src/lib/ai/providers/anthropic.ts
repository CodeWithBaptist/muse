import Anthropic from '@anthropic-ai/sdk';
import type {
  Message as AnthropicMessage,
  MessageParam,
} from '@anthropic-ai/sdk/resources/messages';
import {
  isUsableApiKey,
  JSON_ONLY_INSTRUCTION,
  normalizeConversation,
  type ChatProvider,
  type CompletionRequest,
  type Message,
} from './shared';

/** Claude model used for chat, recommendations, discovery, and profile insights. */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5-5';

export function isAnthropicConfigured(): boolean {
  return isUsableApiKey(process.env.ANTHROPIC_API_KEY);
}

/** Override the model with ANTHROPIC_MODEL (for example claude-haiku-4-5 for cheaper classification). */
export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
}

let _client: Anthropic | null = null;
let _cachedKey: string | null = null;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!isAnthropicConfigured() || !apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  if (!_client || _cachedKey !== apiKey) {
    _client = new Anthropic({ apiKey });
    _cachedKey = apiKey;
  }
  return _client;
}

/**
 * The Messages API takes the system prompt as a top-level parameter and requires
 * at least one user/assistant turn.
 */
export function toAnthropicRequest(messages: Message[]): {
  system?: string;
  messages: MessageParam[];
} {
  const { system, turns } = normalizeConversation(messages);

  return system
    ? { system, messages: turns as MessageParam[] }
    : { messages: turns as MessageParam[] };
}

function toAnthropicRequestFromCompletion(request: CompletionRequest) {
  const { system, turns } = normalizeConversation(request.messages);
  const hoistedSystem = [request.system?.trim(), system].filter(Boolean).join('\n\n');

  return hoistedSystem
    ? { system: hoistedSystem, messages: turns as MessageParam[] }
    : { messages: turns as MessageParam[] };
}

function isAnthropicMessageShape(response: unknown): response is AnthropicMessage {
  return Boolean(
    response &&
      typeof response === 'object' &&
      Array.isArray((response as { content?: unknown }).content)
  );
}

export const anthropicProvider: ChatProvider = {
  id: 'anthropic',
  label: 'Anthropic Claude',

  isConfigured: isAnthropicConfigured,
  getModel: getAnthropicModel,

  async complete(request: CompletionRequest) {
    const client = getClient();
    const base = toAnthropicRequestFromCompletion(request);
    const system = request.json
      ? [base.system, JSON_ONLY_INSTRUCTION].filter(Boolean).join('\n\n')
      : base.system;

    return client.messages.create({
      model: getAnthropicModel(),
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      ...(system ? { system } : {}),
      messages: base.messages,
    });
  },

  async *stream(request: CompletionRequest) {
    const client = getClient();
    const base = toAnthropicRequestFromCompletion(request);

    const stream = await client.messages.create({
      model: getAnthropicModel(),
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      ...(base.system ? { system: base.system } : {}),
      messages: base.messages,
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  },

  extractText(response: unknown) {
    if (!isAnthropicMessageShape(response)) return '';
    return response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('');
  },
};
