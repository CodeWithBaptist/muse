'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  PlusSquare, 
  Compass, 
  Library, 
  Music2,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';

const NAV_ITEMS = [
  { name: 'Chat', icon: PlusSquare, href: '/chat' },
  { name: 'Discover', icon: Compass, href: '/discover' },
  { name: 'Library', icon: Library, href: '/library' },
  { name: 'Playlists', icon: Music2, href: '/playlists' },
];

export function MobileNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);

  // Close menu when pathname changes
  React.useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b border-border-subtle bg-background/80 backdrop-blur-md z-40 flex items-center justify-between px-6">
        <Link href="/" className="flex items-center">
          <Logo variant="wordmark" size={80} />
        </Link>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 -mr-2 text-text-secondary hover:text-text-primary"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="lg:hidden fixed inset-0 top-16 bg-background z-30 p-6 flex flex-col"
          >
            <nav className="space-y-4">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-4 text-2xl font-medium transition-colors',
                    pathname === item.href ? 'text-accent' : 'text-text-primary'
                  )}
                >
                  <item.icon className="w-6 h-6" />
                  {item.name}
                </Link>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Player Placeholder */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-border-subtle bg-background/80 backdrop-blur-md z-40 flex items-center px-6 gap-4">
        <div className="w-10 h-10 bg-surface rounded border border-border-strong flex items-center justify-center shrink-0 overflow-hidden">
          <Logo variant="mark" size={16} className="opacity-20" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-text-muted truncate">No track playing</div>
        </div>
      </div>
    </>
  );
}
