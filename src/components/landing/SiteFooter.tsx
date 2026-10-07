'use client';

import Link from 'next/link';

/**
 * The landing footer: a hairline, the mark, and the three real pages that
 * already exist.
 *
 * Every link points at a route that is in the app, so nothing here is invented.
 * The pages themselves are still review placeholders and need real privacy,
 * terms, and Spotify attribution text before launch, but a link to them is not a
 * link to nothing.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border-subtle px-6 py-12">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <span className="type-display text-lg tracking-[0.02em]">MUSE</span>
          <nav
            aria-label="Footer"
            className="flex flex-wrap justify-center gap-8 type-caption"
          >
            <Link
              href="/privacy"
              className="hover:text-text-primary transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="hover:text-text-primary transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/spotify-attribution"
              className="hover:text-text-primary transition-colors"
            >
              Spotify attribution
            </Link>
          </nav>
          <div className="type-caption text-text-muted">
            &copy; 2026 MUSE. Built for music.
          </div>
        </div>
      </div>
    </footer>
  );
}
