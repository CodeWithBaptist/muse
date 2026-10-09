'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/motion';
import { useAuth } from '@/hooks/use-auth';
import { Logo } from '@/components/ui/Logo';
import { SETTINGS_NAV, isActivePath, navItemsFor } from './shell-nav';
import { DisplayMenu } from './DisplayMenu';

/**
 * Tablet and desktop navigation, shown from the md breakpoint up. Phones get
 * the bottom tabs instead; both read the same destination list.
 */

const NAV_LINK =
  'group relative flex min-h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors focus-ring';

export function Sidebar() {
  const pathname = usePathname();
  const { user, authenticated, logout } = useAuth();
  const [logoutState, setLogoutState] = React.useState<{
    pending: boolean;
    error: string | null;
  }>({ pending: false, error: null });

  const handleLogout = async () => {
    setLogoutState({ pending: true, error: null });
    const result = await logout();
    if (!result.ok) setLogoutState({ pending: false, error: result.message });
  };

  return (
    <aside
      aria-label="Application sidebar"
      className="hidden w-[var(--muse-sidebar-width)] shrink-0 flex-col border-r border-border-subtle bg-background md:flex"
    >
      <div className="flex h-[var(--muse-topbar-height)] items-center px-6">
        <Link
          href="/"
          className="inline-flex rounded-sm focus-ring"
          aria-label="MUSE home"
        >
          <Logo variant="wordmark" size={96} />
        </Link>
      </div>

      <nav
        aria-label="Primary navigation"
        className="flex-1 space-y-1 px-3 pt-2"
      >
        {navItemsFor(authenticated).map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                NAV_LINK,
                active
                  ? 'bg-surface text-text-primary'
                  : 'text-text-secondary hover:bg-surface hover:text-text-primary',
              )}
            >
              <item.icon
                className="h-4 w-4"
                strokeWidth={active ? 2.5 : 2}
                aria-hidden="true"
              />
              <span className={cn(active ? 'font-semibold' : 'font-medium')}>
                {item.label}
              </span>
              {active ? (
                <motion.span
                  layoutId="sidebar-active"
                  aria-hidden="true"
                  className="absolute left-0 h-4 w-0.5 rounded-full bg-accent"
                  transition={transitions.standard}
                />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 border-t border-border-subtle p-3">
        <div className="flex items-center gap-3 px-3 pt-2">
          <DisplayMenu className="-ml-2" />
          {authenticated && user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="h-8 w-8 rounded-full border border-border-strong"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border-strong bg-surface"
            >
              <User className="h-4 w-4 text-text-muted" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-text-primary">
              {authenticated
                ? (user?.displayName ?? 'Spotify account')
                : 'Guest'}
            </div>
            <div className="type-section-label truncate">
              {authenticated
                ? 'Spotify connected'
                : 'Chat stays on this device'}
            </div>
          </div>
        </div>

        <nav aria-label="Account navigation" className="space-y-1">
          {authenticated ? (
            <Link
              href={SETTINGS_NAV.href}
              aria-current={
                isActivePath(pathname, SETTINGS_NAV.href) ? 'page' : undefined
              }
              className={cn(
                NAV_LINK,
                isActivePath(pathname, SETTINGS_NAV.href)
                  ? 'bg-surface text-text-primary'
                  : 'text-text-secondary hover:bg-surface hover:text-text-primary',
              )}
            >
              <SETTINGS_NAV.icon className="h-4 w-4" aria-hidden="true" />
              <span>{SETTINGS_NAV.label}</span>
            </Link>
          ) : null}
          {authenticated ? (
            <>
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={logoutState.pending}
                aria-busy={logoutState.pending || undefined}
                aria-describedby={
                  logoutState.error ? 'sidebar-logout-error' : undefined
                }
                className={cn(
                  NAV_LINK,
                  'w-full text-text-secondary hover:bg-surface hover:text-text-primary disabled:opacity-60',
                )}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>{logoutState.pending ? 'Logging out' : 'Log out'}</span>
              </button>
              {logoutState.error ? (
                <p
                  id="sidebar-logout-error"
                  role="alert"
                  className="px-3 py-1 text-xs leading-relaxed text-danger"
                >
                  {logoutState.error}
                </p>
              ) : null}
            </>
          ) : null}
        </nav>
      </div>
    </aside>
  );
}
