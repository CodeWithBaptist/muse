import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DesignSystemReference } from '@/components/design-system/DesignSystemReference';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'MUSE design system (development)',
  robots: { index: false, follow: false },
};

/**
 * Internal reference for the design tokens and primitives. It exists so each
 * phase can be checked in a real browser; it is not part of the product and
 * is hidden in production unless the operator explicitly enables it.
 */
export default function DesignSystemPage() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.SHOW_DESIGN_SYSTEM !== 'true'
  ) {
    notFound();
  }

  return <DesignSystemReference />;
}
