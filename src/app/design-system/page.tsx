import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DesignSystemReference } from '@/components/design-system/DesignSystemReference';

export const metadata: Metadata = {
  title: 'MUSE design system (development)',
  robots: { index: false, follow: false },
};

/**
 * Internal reference for the design tokens and primitives. It exists so each
 * phase can be checked in a real browser; it is not part of the product and
 * is not served by production builds.
 */
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return <DesignSystemReference />;
}
