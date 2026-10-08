import type { AuthErrorCode } from '@/lib/auth-flow';
import { SPOTIFY_UNAVAILABLE_EXPLANATION } from './spotify-connect-copy';

/**
 * Explains why a Spotify sign-in sent the visitor back.
 *
 * The auth routes redirect to "/login?error=<code>" (and older links to
 * "/?error=<code>") when sign-in cannot continue. The copy only states what
 * each code guarantees: in every case nothing was connected or saved.
 */

export const AUTH_NOTICES: Record<
  AuthErrorCode,
  { title: string; body: string }
> = {
  access_denied: {
    title: 'You did not allow access.',
    body: 'You left Spotify without approving the connection, so nothing was connected. Connect whenever you are ready.',
  },
  session_expired: {
    title: 'That sign-in took too long.',
    body: 'Spotify sign-in has to finish within ten minutes, and this one did not, or your browser did not keep the cookie MUSE needs for it. Nothing was connected. Start again from this page.',
  },
  state_mismatch: {
    title: 'That sign-in did not match this browser.',
    body: 'The reply from Spotify did not match the sign-in MUSE started here, so it was ignored and nothing was connected. This happens when sign-in is started twice or in another tab. Start again from this page.',
  },
  auth_not_configured: {
    title: 'Spotify sign-in is not available here.',
    body: SPOTIFY_UNAVAILABLE_EXPLANATION,
  },
  user_not_registered: {
    title: 'Spotify would not let this account in yet.',
    body: 'Spotify refused the request for this account. While MUSE is in development mode on Spotify, each account has to be added by whoever runs this MUSE before it can sign in. Nothing was connected.',
  },
  token_exchange_failed: {
    title: 'MUSE could not finish connecting to Spotify.',
    body: 'Spotify approved the connection but the final step failed on our side. Nothing was saved. Please try again in a moment.',
  },
  auth_failed: {
    title: 'Spotify sign-in did not complete.',
    body: 'Spotify did not confirm the connection. Nothing was connected. You can try again.',
  },
};

export type AuthNoticeCode = AuthErrorCode;

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
