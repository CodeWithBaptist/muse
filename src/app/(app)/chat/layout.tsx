import type { ReactNode } from 'react';
import { publicPageMetadata } from '@/lib/site-metadata';

export const metadata = publicPageMetadata(
  '/chat',
  'Chat | MUSE',
  'Describe a mood, artist, or moment. Get music recommendations from MUSE without an account.',
);

export default function ChatLayout({ children }: { children: ReactNode }) {
  return children;
}
