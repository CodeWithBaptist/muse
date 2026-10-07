import { getSession } from '@/lib/session';
import { db } from '@/db';
import {
  playlists as playlistsTable,
  playlistTracks as playlistTracksTable,
} from '@/db/schema';
import { verifySameOrigin } from '@/lib/security/csrf';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import {
  PlaylistIdParamSchema,
  PlaylistUpdateInputSchema,
} from '@/lib/validation/api-schemas';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = verifySameOrigin(request);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimited = await enforceRateLimit(request, {
    scope: 'playlists:update',
    limit: 30,
    windowMs: 60_000,
    identifier: `user:${session.userId}`,
  });
  if (rateLimited) return rateLimited;

  const resolvedParams = await params;
  const parsedParams = PlaylistIdParamSchema.safeParse(resolvedParams);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid playlist ID.' }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsedBody = PlaylistUpdateInputSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Invalid playlist update payload.' },
      { status: 400 }
    );
  }

  const { id } = parsedParams.data;
  const { name, description, removeTrackId, trackOrder } = parsedBody.data;

  try {
    const [existing] = await db
      .select()
      .from(playlistsTable)
      .where(
        and(eq(playlistsTable.id, id), eq(playlistsTable.userId, session.userId))
      );

    if (!existing) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }

    if (removeTrackId) {
      const cleanTrackId = removeTrackId.replace(/^spotify:track:/, '');
      await db
        .delete(playlistTracksTable)
        .where(
          and(
            eq(playlistTracksTable.playlistId, id),
            eq(playlistTracksTable.spotifyTrackId, cleanTrackId)
          )
        );
    }

    if (trackOrder) {
      const existingTracks = await db
        .select()
        .from(playlistTracksTable)
        .where(eq(playlistTracksTable.playlistId, id));

      const normalise = (value: string) => value.replace(/^spotify:track:/, '');
      const rowByTrackId = new Map(
        existingTracks.map((row) => [normalise(row.spotifyTrackId), row])
      );

      const requested = trackOrder.map(normalise);
      const isPermutation =
        requested.length === rowByTrackId.size &&
        new Set(requested).size === requested.length &&
        requested.every((trackId) => rowByTrackId.has(trackId));

      if (!isPermutation) {
        return NextResponse.json(
          {
            error:
              'The new order must contain exactly the tracks this playlist has.',
          },
          { status: 400 }
        );
      }

      // One transaction, so a failure part way through cannot leave two rows
      // claiming the same position.
      await db.transaction(async (tx) => {
        for (let position = 0; position < requested.length; position += 1) {
          const row = rowByTrackId.get(requested[position]);
          if (!row) continue;
          await tx
            .update(playlistTracksTable)
            .set({ position })
            .where(eq(playlistTracksTable.id, row.id));
        }
      });
    }

    const updateValues: Partial<typeof playlistsTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (name !== undefined) updateValues.name = name;
    if (description !== undefined) updateValues.description = description;

    const [updated] = await db
      .update(playlistsTable)
      .set(updateValues)
      .where(
        and(eq(playlistsTable.id, id), eq(playlistsTable.userId, session.userId))
      )
      .returning();

    return NextResponse.json({ playlist: updated });
  } catch (error: unknown) {
    console.error('Playlist PATCH error:', error);
    return NextResponse.json(
      { error: 'Unable to update playlist.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = verifySameOrigin(request);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimited = await enforceRateLimit(request, {
    scope: 'playlists:delete',
    limit: 20,
    windowMs: 60_000,
    identifier: `user:${session.userId}`,
  });
  if (rateLimited) return rateLimited;

  const resolvedParams = await params;
  const parsedParams = PlaylistIdParamSchema.safeParse(resolvedParams);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid playlist ID.' }, { status: 400 });
  }

  const { id } = parsedParams.data;

  try {
    const deleted = await db
      .delete(playlistsTable)
      .where(
        and(eq(playlistsTable.id, id), eq(playlistsTable.userId, session.userId))
      )
      .returning({ id: playlistsTable.id });

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Playlist DELETE error:', error);
    return NextResponse.json(
      { error: 'Unable to delete playlist.' },
      { status: 500 }
    );
  }
}
