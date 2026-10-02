'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Compass, 
  Library, 
  PlusSquare, 
  Settings,
  User,
  Music2,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/motion';
import { useAuth } from '@/hooks/use-auth';
import { Logo } from '@/components/ui/Logo';

const NAV_ITEMS = [
  { name: 'New chat', icon: PlusSquare, href: '/chat', primary: true },
  { name: 'Discover', icon: Compass, href: '/discover' },
  { name: 'Library', icon: Library, href: '/library' },
  { name: 'Playlists', icon: Music2, href: '/playlists' },
  { name: 'Profile', icon: User, href: '/profile' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, authenticated, logout } = useAuth();

  return (
    <aside className="w-[240px] border-r border-border-subtle bg-background flex flex-col hidden lg:flex">
      <div className="p-6">
        <Link href="/" className="inline-block">
          <Logo variant="wordmark" size={100} />
        </Link>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group relative flex items-center gap-3 px-4 py-2.5 rounded-md text-sm transition-colors',
                isActive ? 'text-text-primary bg-surface/50' : 'text-text-secondary hover:text-text-primary hover:bg-surface',
                item.primary && 'mb-6 text-accent hover:text-accent hover:bg-accent/5'
              )}
            >
              <item.icon className="w-4 h-4" strokeWidth={isActive ? 2.5 : 2} />
              <span className={cn(isActive ? 'font-semibold' : 'font-medium')}>{item.name}</span>
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 w-0.5 h-4 bg-accent rounded-full"
                  transition={transitions.standard}
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t border-border-subtle space-y-4">
        <div className="flex items-center gap-3 px-2">
          {authenticated && user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.displayName} className="w-8 h-8 rounded-full border border-border-strong" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-surface border border-border-strong flex items-center justify-center">
              <User className="w-4 h-4 text-text-muted" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-text-primary truncate">
              {authenticated ? user?.displayName : 'Not connected'}
            </div>
            <div className="text-[10px] text-text-muted/60 uppercase tracking-tighter font-semibold">
              {authenticated ? 'Spotify Connected' : 'Spotify'}
            </div>
          </div>
        </div>
        
        <div className="space-y-1">
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-text-secondary hover:text-text-primary hover:bg-surface',
              pathname === '/settings' && 'text-text-primary'
            )}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </Link>
          {authenticated && (
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-text-secondary hover:text-text-primary hover:bg-surface"
            >
              <LogOut className="w-4 h-4" />
              <span>Log out</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
