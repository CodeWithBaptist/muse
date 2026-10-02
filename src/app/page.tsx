import { Hero } from '@/components/landing/Hero';
import { ProductPreview } from '@/components/landing/ProductPreview';
import { HowItWorks, Features, Footer } from '@/components/landing/LandingSections';

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <main>
        <Hero />
        <ProductPreview />
        <HowItWorks />
        <Features />
      </main>
      <Footer />
    </div>
  );
}
