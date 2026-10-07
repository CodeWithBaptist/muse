import { SPOTIFY_UNAVAILABLE_EXPLANATION } from './SpotifyPrimaryAction';

/**
 * Explains why a Spotify sign-in sent the visitor back to the landing page.
 *
 * The auth routes redirect to "/?error=<code>" when sign-in cannot continue.
 * Before this component the landing swallowed those codes and the visitor saw
 * the homepage again with no explanation. The copy only states what the code
 * guarantees: in every case nothing was connected or saved.
 */

export const AUTH_NOTICES = {
  auth_failed: {
    title: 'Spotify sign-in did not complete.',
    body: 'Spotify did not confirm the connection, or the sign-in took longer than ten minutes. Nothing was connected. You can try again.',
  },
  auth_not_configured: {
    title: 'Spotify sign-in is not available here.',
    body: SPOTIFY_UNAVAILABLE_EXPLANATION,
  },
  token_exchange_failed: {
    title: 'MUSE could not finish connecting to Spotify.',
    body: 'Spotify approved the connection but the final step failed on our side. Nothing was saved. Please try again in a moment.',
  },
} as const;

export type AuthNoticeCode = keyof typeof AUTH_NOTICES;

const FALLBACK_NOTICE = {
  title: 'Spotify sign-in did not complete.',
  body: 'Nothing was connected. You can try again.',
};

export function isAuthNoticeCode(code: string): code is AuthNoticeCode {
  return Object.prototype.hasOwnProperty.call(AUTH_NOTICES, code);
}

/**
 * Reads the "error" query parameter the auth routes redirect with. Codes are
 * short lowercase identifiers; anything else is ignored so arbitrary input
 * never reaches the page.
 */
export function readAuthErrorParam(
  searchParams: Record<string, string | string[] | undefined>,
): string | undefined {
  const raw = searchParams.error;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  return /^[a-z_]{1,64}$/.test(value) ? value : undefined;
}

export function resolveAuthNotice(code: string | undefined) {
  if (!code) return null;
  return isAuthNoticeCode(code) ? AUTH_NOTICES[code] : FALLBACK_NOTICE;
}

export function AuthNotice({
  code,
  className,
}: {
  code?: string;
  className?: string;
}) {
  const notice = resolveAuthNotice(code);
  if (!notice) return null;

  return (
    <div
      role="status"
      data-auth-notice={code}
      className={[
        'mx-auto w-full max-w-md rounded-md border border-border-strong bg-surface px-4 py-3 text-left',
        className ?? '',
      ]
        .join(' ')
        .trim()}
    >
      <p className="text-sm font-semibold text-text-primary">{notice.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-text-secondary">
        {notice.body}
      </p>
    </div>
  );
}
