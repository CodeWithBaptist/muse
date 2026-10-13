import type { Metadata } from 'next';
import { NO_INDEX } from '@/lib/site-metadata';
import { AppShell } from '@/components/shell/AppShell';

export const metadata: Metadata = { robots: NO_INDEX };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
