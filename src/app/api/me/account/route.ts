import { enforceRateLimit } from '@/lib/security/rate-limit';
import { verifySameOrigin } from '@/lib/security/csrf';
import { deleteSession, getSession } from '@/lib/session';
import { deleteUserAccountData } from '@/lib/user-data';
import { SuccessResponseSchema } from '@/lib/validation/api-schemas';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function DELETE(request: Request) {
  const csrfError = verifySameOrigin(request);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimited = await enforceRateLimit(request, {
    scope: 'account:delete',
    limit: 3,
    windowMs: 60_000,
    identifier: `user:${session.userId}`,
  });
  if (rateLimited) return rateLimited;

  try {
    await deleteUserAccountData(session.userId);
    await deleteSession();
    return NextResponse.json(SuccessResponseSchema.parse({ success: true }), {
      headers: { 'Cache-Control': 'no-store, private' },
    });
  } catch {
    console.error('Account deletion request failed.');
    return NextResponse.json(
      { error: 'Unable to delete the MUSE account right now.' },
      { status: 500 },
    );
  }
}
