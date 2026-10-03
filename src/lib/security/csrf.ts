import { NextResponse } from 'next/server';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function extractHost(urlOrOrigin: string): string | null {
  try {
    return new URL(urlOrOrigin).host.toLowerCase();
  } catch {
    return null;
  }
}

export function verifySameOrigin(request: Request): NextResponse | null {
  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    return null;
  }

  const originHeader = request.headers.get('origin');
  const refererHeader = request.headers.get('referer');

  // Same-origin server tests or non-browser requests without Origin/Referer
  if (!originHeader && !refererHeader) {
    return null;
  }

  const expectedHost = (
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    extractHost(request.url) ||
    ''
  )
    .split(',')[0]
    .trim()
    .toLowerCase();

  const sourceHost = originHeader
    ? extractHost(originHeader)
    : refererHeader
      ? extractHost(refererHeader)
      : null;

  if (!sourceHost || !expectedHost || sourceHost !== expectedHost) {
    return NextResponse.json(
      {
        error: 'Forbidden cross-origin request.',
        code: 'CSRF_REJECTED',
      },
      { status: 403 }
    );
  }

  return null;
}
