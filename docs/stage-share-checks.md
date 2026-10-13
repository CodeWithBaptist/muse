# Stage 2 report

## Changes

* Added metadataBase, per-page canonical URLs, full Open Graph metadata and Twitter large-image cards for home, chat and the three legal pages.
* Added 1200x630 PNG routes at `/opengraph-image` and `/twitter-image`. They share the current Logo SVG outlines, lime dot, near-black background and the requested line in Fredoka. The wordmark remains the current uppercase MUSE artwork; it is not retyped in a font. Content stays at least 80px inside the image edges.
* The font is a local static instance derived from the UI font already installed in the project, with its license included. Image rendering has no external font or image request. No dependency was added.
* Retained the existing 180px apple touch icon. No duplicate apple icon was needed.
* Added robots and sitemap routes. Only home, chat, Privacy, Terms and Spotify Attribution are indexed. Tester pages, login, design-system and closed Plus are noindex. The robots rules also disallow API crawling. Robots rules are not access control.
* Filled Neon, Nigerian governing law and Lagos courts from the owner instructions. Identified Vercel from the supplied deployment context. Removed unconfirmed region placeholders without inventing regions. All legal pages display Last updated: 13 October 2026.
* Added a publication guard that renders all five public pages and fails on a legal Placeholder component.
* The production design page returns 404 unless SHOW_DESIGN_SYSTEM equals exactly true. It remains excluded from the sitemap and noindex even with the override.
* Added metadata, crawling, SVG consistency, local PNG rendering and design-page gate tests. Updated the decision record.

## Privacy owner review

Every rendered paragraph and list item in the Privacy page is listed in [stage-share-privacy-inventory.md](stage-share-privacy-inventory.md). A test keeps this inventory synchronized with the page. It includes storage keys, message and taste limits, AI requests and budgets, catalogues, sharing, logs, hashed identifiers, cookies, tester data, retention, deletion, providers, transfers, security and legal assertions.

The existing README and docs contained no Neon hostname pattern. The provider is therefore owner-supplied, not independently verified. No connection string or secret was inspected. The owner should confirm the database provider and processing regions in their own dashboard, without posting credentials. Provider policies, processor contracts, log retention and legal assertions remain owner or counsel review items. There is no claim that a lawyer reviewed the pages.

## Verification

* Typecheck passed.
* ESLint passed with seven existing image warnings and no errors.
* Full Vitest suite passed: 96 files, 607 tests.
* Production build passed and generated both share-image routes locally.
* Production HTTP checks confirmed both share-image endpoints return 200, image/png and 1200x630 PNG bytes.
* The generated card was opened for visual inspection. The current SVG wordmark, lime dot and complete two-line description are visible within the safe area.
* Production HTTP checks confirmed canonical and social metadata for all five public pages, noindex on all tester pages and closed Plus, and the expected robots and sitemap contents.
* The production design page returned 404 with no override, and 200 with SHOW_DESIGN_SYSTEM=true. Both responses were noindex. The temporary override server was stopped after verification.
* Browser and external preview-service behavior could not be verified here. Chromium is unavailable and the external production host and preview checkers are outside this environment's network access.

## Vercel settings for the owner

Set these yourself in the Vercel project environment settings:

| Name | Value | Scope |
| --- | --- | --- |
| NEXT_PUBLIC_SITE_URL | https://muse-six-pink.vercel.app | Production; also Preview if preview builds should use production canonicals |
| SHOW_DESIGN_SYSTEM | Leave unset, or false | Production and public Preview builds |

NEXT_PUBLIC_SITE_URL is intentionally public and contains no secret. The default is already the production URL. If a custom domain replaces it, change the variable and redeploy. Metadata generated at build time requires a new build after changing the public origin. Use SHOW_DESIGN_SYSTEM=true only for a deliberate internal review; noindex does not make it private.

No secret values or other environment changes are required for Stage 2.

## After an approved deployment

Paste these page URLs into your preferred link preview checker:

* https://muse-six-pink.vercel.app/
* https://muse-six-pink.vercel.app/chat
* https://muse-six-pink.vercel.app/privacy
* https://muse-six-pink.vercel.app/terms
* https://muse-six-pink.vercel.app/spotify-attribution

Expect each page's own title, description and canonical URL, MUSE as siteName, en_NG locale and a large card showing the current MUSE wordmark, lime dot and this exact text:

> Tell MUSE the mood. It answers with real songs, Nigeria first.

Direct image URLs:

* https://muse-six-pink.vercel.app/opengraph-image
* https://muse-six-pink.vercel.app/twitter-image

Both should return 1200x630 PNGs. They share the same design. Check a real WhatsApp, X and iMessage share for cropping and stale preview caches. Request a fresh scrape if the old card remains cached. Deployment preview protection may prevent social crawlers from fetching a preview build, so perform the public-domain check only after an approved deployment.

Also inspect `/robots.txt` and `/sitemap.xml`, confirm `/design-system` returns 404, and read all three legal pages for the date and filled values. Review the complete Privacy inventory against production reality before merging.

## Git scope and stop point

This fixed session branch cannot create stage-share. GitHub permits only one open PR for this head/base pair, so PR #12 contains the earlier work, Stage 1 and a separate Stage 2 commit. Nothing was merged or pushed to main. Stage 3 has not begun.
