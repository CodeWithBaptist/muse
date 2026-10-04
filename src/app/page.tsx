import { Hero } from '@/components/landing/Hero';
import { ProductPreview } from '@/components/landing/ProductPreview';
import { HowItWorks, Features, Footer } from '@/components/landing/LandingSections';

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
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <ProductPreview />
        <HowItWorks />
        <Features />
      </main>
      <Footer />
    </div>
  );
}
