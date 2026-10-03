import OpenAI from 'openai';

export const AI_NOT_CONNECTED_CODE = 'AI_NOT_CONNECTED' as const;
export const AI_NOT_CONNECTED_MESSAGE = 'AI is not connected yet';

const PLACEHOLDER_AI_KEYS = new Set([
  'add-later',
  'add_later',
  'placeholder',
  'your-openai-api-key',
  'your_openai_api_key',
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

export function isAIConfigured(): boolean {
  const raw = process.env.OPENAI_API_KEY?.trim();
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
    if (typeof maybeMessage === 'string' && /AI is not connected yet|OPENAI_API_KEY/i.test(maybeMessage)) {
      return true;
    }
  }
  return false;
}

let _openai: OpenAI | null = null;
let _cachedKey: string | null = null;

function getOpenAI(): OpenAI {
  if (!isAIConfigured()) {
    _openai = null;
    _cachedKey = null;
    throw new AINotConnectedError();
  }

  const apiKey = process.env.OPENAI_API_KEY!.trim();
  if (!_openai || _cachedKey !== apiKey) {
    _openai = new OpenAI({ apiKey });
    _cachedKey = apiKey;
  }
  return _openai;
}

export type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export async function chatCompletion(messages: Message[], stream = false) {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    stream,
    temperature: 0.7,
  });

  return response;
}

export async function structuredCompletion<T>(
  prompt: string,
  schema: unknown,
  systemPrompt = 'You are a helpful music assistant.'
): Promise<T> {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('AI failed to generate content');
  
  return JSON.parse(content) as T;
}
