import { getSession } from '@/lib/session';
import { db } from '@/db';
import { preferences as preferencesTable } from '@/db/schema';
import { verifySameOrigin } from '@/lib/security/csrf';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import {
  UserPreferencesInputSchema,
  UserPreferencesResponseSchema,
} from '@/lib/validation/api-schemas';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await db
      .select()
      .from(preferencesTable)
      .where(eq(preferencesTable.userId, session.userId));

    const map = new Map<string, string>();
    let latestUpdate: Date | null = null;
    for (const row of rows) {
      map.set(row.key, row.value);
      if (!latestUpdate || row.updatedAt > latestUpdate) {
        latestUpdate = row.updatedAt;
      }
    }

    const parsed = UserPreferencesInputSchema.safeParse({
      discoveryStyle: map.get('discoveryStyle'),
      playlistLength: map.get('playlistLength'),
      explicitContent: map.get('explicitContent'),
      favoriteGenres: map.get('favoriteGenres'),
      playbackPreference: map.get('playbackPreference'),
    });

    const data = parsed.success
      ? parsed.data
      : {
          discoveryStyle: 'balanced' as const,
          playlistLength: '15' as const,
          explicitContent: 'allow' as const,
          favoriteGenres: '',
          playbackPreference: 'muse' as const,
        };

    return NextResponse.json(
      UserPreferencesResponseSchema.parse({
        ...data,
        updatedAt: latestUpdate ? latestUpdate.toISOString() : null,
      })
    );
  } catch (error: unknown) {
    console.error('Preferences GET error:', error);
    return NextResponse.json(
      { error: 'Unable to load preferences.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const csrfError = verifySameOrigin(request);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimited = await enforceRateLimit(request, {
    scope: 'preferences:update',
    limit: 20,
    windowMs: 60_000,
    identifier: `user:${session.userId}`,
  });
  if (rateLimited) return rateLimited;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = UserPreferencesInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid preference values.' },
      { status: 400 }
    );
  }

  const entries: Array<[string, string]> = [
    ['discoveryStyle', parsed.data.discoveryStyle],
    ['playlistLength', parsed.data.playlistLength],
    ['explicitContent', parsed.data.explicitContent],
    ['favoriteGenres', parsed.data.favoriteGenres],
    ['playbackPreference', parsed.data.playbackPreference],
  ];

  const now = new Date();

  try {
    for (const [key, value] of entries) {
      const existing = await db
        .select({ id: preferencesTable.id })
        .from(preferencesTable)
        .where(
          and(
            eq(preferencesTable.userId, session.userId),
            eq(preferencesTable.key, key)
          )
        );

      if (existing.length > 0) {
        await db
          .update(preferencesTable)
          .set({
            value,
            confidence: 100,
            source: 'explicit',
            updatedAt: now,
          })
          .where(eq(preferencesTable.id, existing[0].id));
      } else {
        await db.insert(preferencesTable).values({
          userId: session.userId,
          key,
          value,
          confidence: 100,
          source: 'explicit',
          updatedAt: now,
        });
      }
    }

    return NextResponse.json(
      UserPreferencesResponseSchema.parse({
        ...parsed.data,
        updatedAt: now.toISOString(),
      })
    );
  } catch (error: unknown) {
    console.error('Preferences PUT error:', error);
    return NextResponse.json(
      { error: 'Unable to save preferences right now.' },
      { status: 500 }
    );
  }
}
