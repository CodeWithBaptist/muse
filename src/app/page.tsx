import { Hero } from '@/components/landing/Hero';
import { ProductPreview } from '@/components/landing/ProductPreview';
import { HowItWorks, Features, Footer } from '@/components/landing/LandingSections';

export const dynamic = "force-dynamic";

/**
 * Whether Spotify OAuth can actually start.
 *
 * Mirrors the check the authorize route performs, so the landing page never
 * offers a connection action that would land the visitor on a bare JSON error.
 * Reads no secret values and exposes only a boolean to the client.
 */
function isSpotifyConfigured(): boolean {
  return Boolean(
    process.env.SPOTIFY_CLIENT_ID?.trim() && process.env.SPOTIFY_REDIRECT_URI?.trim(),
  );
}

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
        <Hero spotifyConfigured={isSpotifyConfigured()} />
        <ProductPreview />
        <HowItWorks />
        <Features />
      </main>
      <Footer />
    </div>
  );
}
