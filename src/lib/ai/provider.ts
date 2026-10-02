import OpenAI from 'openai';

let _openai: OpenAI | null = null;

function getOpenAI() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
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
  schema: any,
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
