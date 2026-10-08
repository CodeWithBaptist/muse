'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/hooks/use-auth';
import { SETTINGS_NAV, isActivePath } from './shell-nav';

/**
 * The phone header: wordmark on the left, Settings on the right. Everything
 * else lives in the bottom tabs, so this bar never needs a menu button.
 * It is in normal flow inside the shell column, not fixed, so it respects the
 * top safe area on notched phones through its own padding.
 */
export function TopBar() {
  const pathname = usePathname();
  const { authenticated } = useAuth();
  const settingsActive = isActivePath(pathname, SETTINGS_NAV.href);

  return (
    <header
      aria-label="App header"
      className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-background px-4 pt-[var(--muse-safe-top)] lg:hidden"
    >
      <div className="flex h-[var(--muse-topbar-height)] items-center">
        <Link
          href="/"
          className="inline-flex rounded-sm focus-ring"
          aria-label="MUSE home"
        >
          <Logo variant="wordmark" size={80} />
        </Link>
      </div>
      {authenticated ? (
        <Link
          href={SETTINGS_NAV.href}
          aria-label={SETTINGS_NAV.label}
          aria-current={settingsActive ? 'page' : undefined}
          className={cn(
            'inline-flex h-11 w-11 items-center justify-center rounded-md transition-colors focus-ring',
            settingsActive
              ? 'bg-surface text-text-primary'
              : 'text-text-secondary hover:bg-surface hover:text-text-primary',
          )}
        >
          <SETTINGS_NAV.icon className="h-5 w-5" aria-hidden="true" />
        </Link>
      ) : null}
    </header>
  );
}
