'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { NowPlaying } from './NowPlaying';
import { MobileNav } from './MobileNav';
import { transitions } from '@/lib/motion';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { authenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!isLoading && !authenticated && pathname !== '/') {
      router.push('/');
    }
  }, [authenticated, isLoading, pathname, router]);

  if (isLoading && pathname !== '/') {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              animate={{ height: [4, 12, 4] }}
              transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.1 }}
              className="w-1 bg-accent rounded-full"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <MobileNav />
      
      <main className="flex-1 flex flex-col min-w-0 relative lg:pt-0 pt-16 lg:pb-0 pb-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={transitions.standard}
            className="flex-1 overflow-y-auto"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <NowPlaying />
    </div>
  );
}
