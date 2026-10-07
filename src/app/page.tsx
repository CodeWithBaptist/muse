import { SiteHeader } from '@/components/landing/SiteHeader';
import { Hero } from '@/components/landing/Hero';
import { ProductPreview } from '@/components/landing/ProductPreview';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { WhatItDoes } from '@/components/landing/WhatItDoes';
import { ClosingBand } from '@/components/landing/ClosingBand';
import { SiteFooter } from '@/components/landing/SiteFooter';

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-50 rounded-md bg-surface px-4 py-3 text-sm font-semibold text-text-primary focus:not-sr-only"
      >
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <ProductPreview />
        <HowItWorks />
        <WhatItDoes />
        <ClosingBand />
      </main>
      <SiteFooter />
    </div>
  );
}
