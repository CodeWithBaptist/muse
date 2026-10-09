'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { isActivePath, navItemsFor, SETTINGS_NAV } from './shell-nav';

/**
 * Phone navigation uses up to six tabs. Each tab is at least 44px tall, the
 * bar pads itself for the home indicator, and the active tab is told apart by
 * colour, weight, and a small accent mark so it never relies on colour alone.
 */
export function BottomTabs() {
  const pathname = usePathname();
  const { authenticated } = useAuth();
  const items = authenticated
    ? [...navItemsFor(authenticated), SETTINGS_NAV]
    : navItemsFor(authenticated);

  // A bar with one destination navigates nowhere; guests get the space back.
  if (items.length < 2) return null;

  return (
    <nav
      aria-label="Primary navigation"
      data-testid="bottom-tabs"
      className="muse-bottom-tabs fixed inset-x-0 bottom-0 z-50 border-t border-border-subtle bg-background pb-[var(--muse-safe-bottom)] md:hidden"
    >
      <ul
        className="grid h-[var(--muse-bottom-nav-height)]"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-full min-h-11 w-full flex-col items-center justify-center gap-1 rounded-md transition-colors focus-ring',
                  active
                    ? 'text-text-primary'
                    : 'text-text-muted hover:text-text-secondary',
                )}
              >
                <item.icon
                  className="h-5 w-5"
                  strokeWidth={active ? 2.5 : 2}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    'max-w-full truncate text-xs leading-none',
                    active ? 'font-semibold' : 'font-medium',
                  )}
                >
                  {item.label}
                </span>
                {active ? (
                  <span
                    aria-hidden="true"
                    data-tab-indicator=""
                    className="absolute top-0 h-0.5 w-6 rounded-full bg-accent"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
