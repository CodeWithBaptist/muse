'use client';

import Link from 'next/link';
import { ArrowUp } from 'lucide-react';
import { LANDING_TOP_FRAGMENT, landingTopClickHandler } from '@/lib/landing-scroll';
import { LandingMark } from './LandingMark';

/**
 * The landing footer: a hairline, the mark, and the three real pages that
 * already exist.
 *
 * The mark is the same wordmark the header carries, at footer size, so the top
 * and the bottom of the page are one shape rather than a wordmark up there and
 * a word of text down here.
 *
 * The mark and the small control beside the copyright both take the visitor
 * back to the top of the page. They are real anchors on the `#top` fragment,
 * so they work with no JavaScript at all, and the click handler only upgrades
 * the jump to a smooth scroll when motion is allowed.
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
          <a
            href={LANDING_TOP_FRAGMENT}
            onClick={landingTopClickHandler()}
            aria-label="MUSE, back to the top of the page"
            className="rounded-sm transition-opacity hover:opacity-70 focus-ring"
          >
            <LandingMark pieceHeight={14} />
          </a>
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
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 type-caption text-text-muted">
            <span>&copy; 2026 MUSE. Built for music.</span>
            <a
              href={LANDING_TOP_FRAGMENT}
              onClick={landingTopClickHandler()}
              data-testid="back-to-top"
              className="inline-flex items-center gap-1.5 rounded-sm text-text-secondary transition-colors hover:text-text-primary focus-ring"
            >
              <ArrowUp size={12} strokeWidth={2} aria-hidden="true" />
              Back to top
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
