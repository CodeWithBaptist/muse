import { deleteSession } from '@/lib/session';
import { verifySameOrigin } from '@/lib/security/csrf';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { LogoutResponseSchema } from '@/lib/validation/api-schemas';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request?: Request) {
  if (request) {
    const csrfError = verifySameOrigin(request);
    if (csrfError) return csrfError;

    const rateLimited = await enforceRateLimit(request, {
      scope: 'auth:logout',
      limit: 20,
      windowMs: 60_000,
    });
    if (rateLimited) return rateLimited;
  }

  try {
    await deleteSession();
    const payload = LogoutResponseSchema.parse({ success: true });
    return NextResponse.json(payload);
  } catch (error: unknown) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Unable to log out right now.' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to log out.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}
