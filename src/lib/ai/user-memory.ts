import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { memories } from '@/db/schema';
import { sanitizePromptInput } from './provider';

export async function getUserMemoryForPrompt(userId: string) {
  try {
    const rows = await db
      .select({
        key: memories.key,
        value: memories.value,
        confidence: memories.confidence,
      })
      .from(memories)
      .where(and(eq(memories.userId, userId), eq(memories.source, 'explicit')))
      .orderBy(desc(memories.updatedAt))
      .limit(12);

    return rows.map((row) => ({
      preference: sanitizePromptInput(row.key, 80),
      value: sanitizePromptInput(row.value, 300),
      confidence: row.confidence,
    }));
  } catch {
    console.error('AI memory lookup failed.');
    return [];
  }
}

export function formatUserMemoryContext(
  items: Awaited<ReturnType<typeof getUserMemoryForPrompt>>,
) {
  if (items.length === 0) return '';
  return JSON.stringify(items);
}
