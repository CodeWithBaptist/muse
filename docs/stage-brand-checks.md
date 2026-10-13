# Stage 1 verification

## Scope

Lime tokens, generated icons, asset synchronization, contrast assertions and documentation only. Earlier guest, legal and copy changes are in a separate preceding commit on the same session branch. No Stage 2 or Stage 3 work was started. No dependencies, environment variables or Vercel settings were added.

## Palette and contrast

| Use | Color | Verified contrast |
| --- | --- | --- |
| Dark accent and primary fill | `#A8E85C` | 13.46:1 on `#0B0B0C`; 12.90:1 on `#111113` |
| Text on primary fills | `#0B0B0C` | 13.46:1 on dark primary fill; 5.26:1 on light primary fill |
| Light links and focus | `#375B0D` | 7.29:1 on `#F7F6F2`; 7.88:1 on white |
| Light primary fill | `#5A9315` | 3.46:1 on `#F7F6F2`; 3.74:1 on white |
| Light primary hover fill | 90% light primary over the background | 3.001:1 on `#F7F6F2` |

Unchanged lime on white was rejected for light controls because it fails the existing 3:1 assertion. The darkest required link state is the existing 80% accent label. Color selection darkens the original lime hue and saturation to cover those states rather than weakening tests. No contrast assertion fails in the token suite. Browser-rendered contrast is not yet verified in this environment.

Existing neutrals are unchanged. Icon SVG paths and rounded-square geometry are unchanged. The maskable glyph retains its existing centered 72% scale and pixel bounds. All favicon PNGs, maskable PNGs and the ICO were regenerated. Static SVG and manifest colors are synchronized by the existing icon script reading `src/lib/design-tokens.ts`.

## Automated checks

- Typecheck passes.
- ESLint passes with seven existing image-element warnings and no errors.
- Full Vitest suite passes: 92 files and 596 tests.
- Production build passes.
- Production HTTP smoke checks return 200 for `/`, `/chat`, `/site.webmanifest`, `/favicon.svg` and both maskable PNGs. The home theme-color meta is `#A8E85C`.
- No previous blue palette values remain in current source, assets, tests or the design-system guide. Historical decision entries remain historical records.
- No landing animation logic changed.

## Browser limitation and exact follow-up

The environment has no installed Chromium executable. `npx playwright install chromium` fails when reaching `cdn.playwright.dev`. All four responsive brand checks stop at browser launch, not at a UI assertion. The live Vercel site was not inspected. Do not treat the mobile and desktop visual review as complete.

On a machine with browser download access, run:

```sh
npm ci
npx playwright install chromium
npm run test:e2e -- --grep 'brand at'
```

Expected result: four passing tests, for 375px and 1440px in both themes. The suite checks home and guest chat, rendered color contrast through the existing Axe dependency, horizontal overflow, keyboard focus color, theme switching, Lite mode and reduced motion. Screenshots are saved under `test-results/` for visual review. On Linux, install Playwright's system browser prerequisites if prompted.

For a production-mode review, use two terminals:

```sh
npm run build
npm run start -- --hostname 0.0.0.0 --port 3100
```

```sh
npm run test:e2e -- --grep 'brand at'
```

The existing Playwright configuration reuses the server on port 3100 outside CI. No API credentials are needed for these browser checks; the existing API fixtures supply guest responses.

## Owner review before merging

1. Inspect home and guest chat at 375px and 1440px in both themes. Confirm the lime dot, primary labels, focus rings, tinted badges and no clipping.
2. Inspect active and hover controls in the tester views, especially Playback, Library tabs and Settings. Token checks cover their shared color pairs, but authenticated live behavior was not exercised.
3. Toggle Lite mode, change themes, and enable reduced motion. Confirm the existing animation behavior is unchanged when full effects return.
4. Hard-refresh the favicon. Reinstall a test PWA if an installed icon remains cached. Confirm the rounded lime square, dark glyph and maskable safe area on a phone.
5. Review the preceding guest and legal commit too, since the owner chose to continue on the existing branch and the pull request includes it.

No Vercel setting changes are required for Stage 1. Do not merge until the browser checks and owner review are satisfactory.
