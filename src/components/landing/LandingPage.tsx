import { SiteHeader } from './SiteHeader';
import { Hero } from './Hero';
import { ProductPreview } from './ProductPreview';
import { HowItWorks } from './HowItWorks';
import { WhatItDoes } from './WhatItDoes';
import { ClosingBand } from './ClosingBand';
import { SiteFooter } from './SiteFooter';

/**
 * The landing page body.
 *
 * Everything that needs the server (reading the environment, reading the
 * query string) happens in src/app/page.tsx and arrives here as plain props,
 * so this tree renders the same on the server, in the browser, and in tests.
 */
export interface LandingPageProps {
  /** Error code the auth routes sent the visitor back with, if any. */
  authError?: string;
}

export function LandingPage({ authError }: LandingPageProps) {
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
        <Hero authError={authError} />
        <ProductPreview />
        <HowItWorks />
        <WhatItDoes />
        <ClosingBand />
      </main>
      <SiteFooter />
    </div>
  );
}
