'use client';

import * as React from 'react';
import Link from 'next/link';
import { User } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useAuth } from '@/hooks/use-auth';
import { DisplayOptions } from './DisplayMenu';
import { SETTINGS_NAV } from './shell-nav';

/**
 * The phone account sheet, for testers with a Spotify connection only.
 *
 * A visitor without an account has nothing to open here: no sign-in, no
 * settings, no log out. Display settings stay reachable next to it in the
 * header, so the guest loses no control when the chip is not drawn.
 */
export function AccountSheet() {
  const { authenticated, user, logout } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const close = () => setOpen(false);
  async function leave() {
    setPending(true);
    setError(null);
    try {
      const result = await logout();
      if (!result.ok) setError(result.message);
    } catch {
      setError('Unable to log out right now. Please try again.');
    } finally {
      setPending(false);
    }
  }
  if (!authenticated) return null;
  return (
    <>
      <button
        type="button"
        aria-label="Account"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          event.currentTarget.focus();
          setOpen(true);
        }}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-strong focus-ring"
      >
        {user?.avatarUrl ? (
          // The existing profile image is loaded from the same source as the sidebar.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <User size={20} aria-hidden="true" />
        )}
      </button>
      <BottomSheet open={open} onClose={close} title="Account">
        <div className="space-y-6">
          <div className="space-y-1 break-words">
            <p className="font-semibold">
              {user?.displayName || 'Spotify account'}
            </p>
            <p className="text-sm text-text-secondary">Spotify connected</p>
          </div>
          <DisplayOptions />
          <div className="space-y-2">
            <Link
              href={SETTINGS_NAV.href}
              onClick={close}
              className="flex min-h-11 items-center rounded-md px-3 focus-ring"
            >
              Settings
            </Link>
            <button
              type="button"
              disabled={pending}
              aria-busy={pending || undefined}
              onClick={() => void leave()}
              className="flex min-h-11 w-full items-center rounded-md px-3 focus-ring"
            >
              {pending ? 'Logging out' : 'Log out'}
            </button>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
