import { GoogleGenAI } from '@google/genai';
import {
  isUsableApiKey,
  JSON_ONLY_INSTRUCTION,
  normalizeConversation,
  type ChatProvider,
  type CompletionRequest,
} from './shared';

/**
 * Google AI Studio's free tier tracks whichever Flash model is current, so the
 * default is the rolling alias rather than a pinned version. Override with
 * GEMINI_MODEL if you want a fixed model or a Pro-tier model on a paid key.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';

export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
}

export function isGeminiConfigured(): boolean {
  return isUsableApiKey(getGeminiApiKey());
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

let _client: GoogleGenAI | null = null;
let _cachedKey: string | null = null;

function getClient(): GoogleGenAI {
  const apiKey = getGeminiApiKey();
  if (!isGeminiConfigured() || !apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  if (!_client || _cachedKey !== apiKey) {
    _client = new GoogleGenAI({ apiKey });
    _cachedKey = apiKey;
  }
  return _client;
}

/**
 * Gemini calls the assistant role "model" and takes the system prompt in config.
 * The system prompt can arrive either as its own argument (structured calls) or
 * as a system turn inside the message list (chat), so both are collected.
 */
function toGeminiRequest(request: CompletionRequest) {
  const { system, turns } = normalizeConversation(request.messages);
  const systemPrompt = [request.system?.trim(), system].filter(Boolean).join('\n\n');

  return {
    system: systemPrompt,
    contents: turns.map((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }],
    })),
    config: {
      ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
      temperature: request.temperature,
      maxOutputTokens: request.maxTokens,
      ...(request.json ? { responseMimeType: 'application/json' } : {}),
    },
  };
}

interface GeminiTextChunk {
  text?: string;
}

function readCandidateText(response: unknown): string {
  if (!response || typeof response !== 'object') return '';

  // The SDK exposes a `text` getter that concatenates the text parts of the
  // first candidate; prefer it and fall back to walking candidates directly.
  const direct = (response as GeminiTextChunk).text;
  if (typeof direct === 'string' && direct.length > 0) return direct;

  const candidates = (response as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return '';

  return candidates
    .map((candidate) => {
      const parts = (candidate as { content?: { parts?: unknown } })?.content?.parts;
      if (!Array.isArray(parts)) return '';
      return parts
        .map((part) => {
          const text = (part as { text?: unknown })?.text;
          return typeof text === 'string' ? text : '';
        })
        .join('');
    })
    .join('');
}

export const geminiProvider: ChatProvider = {
  id: 'gemini',
  label: 'Google Gemini',

  isConfigured: isGeminiConfigured,
  getModel: getGeminiModel,

  async complete(request: CompletionRequest) {
    const client = getClient();
    const payload = toGeminiRequest(request);
    const system = [payload.system, request.json ? JSON_ONLY_INSTRUCTION : undefined]
      .filter(Boolean)
      .join('\n\n');

    return client.models.generateContent({
      model: getGeminiModel(),
      contents: payload.contents,
      config: {
        ...payload.config,
        ...(system ? { systemInstruction: system } : {}),
      },
    });
  },

  async *stream(request: CompletionRequest) {
    const client = getClient();
    const payload = toGeminiRequest(request);

    const stream = await client.models.generateContentStream({
      model: getGeminiModel(),
      contents: payload.contents,
      config: payload.config,
    });

    for await (const chunk of stream) {
      const text = readCandidateText(chunk);
      if (text) yield text;
    }
  },

  extractText: readCandidateText,
};
