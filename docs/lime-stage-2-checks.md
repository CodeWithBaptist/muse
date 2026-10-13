# Stage 2: lime accent verification

Date: 13 October 2026. Stage authorized by the owner's explicit continuation.

## Scope

The baseline already contained dark lime, olive light text, lime icons, manifest and metadata from earlier work. This stage changes the light primary fill from darkened green to bright lime and adds explicit control boundaries. It does not replace the typography, change the default theme, modify wordmark geometry, redesign the homepage or change integrations.

The session is fixed to `arena/f36706d9-muse`. A separate `accent-lime` branch and independent PR cannot be created here. This work is a separate conventional commit on the existing draft PR 12. Its cumulative diff also contains earlier stages. No merge or push to main is authorized.

## Final accent tokens

| Role | Dark | Light |
| --- | --- | --- |
| Accent text, icons and focus | #A8E85C | #375B0D |
| Primary fill | #A8E85C | #A8E85C |
| Text on primary fill | #0B0B0C | #0B0B0C |
| Primary control border | #A8E85C | #375B0D |

Backgrounds remain #0B0B0C / #111113 in dark mode and #F7F6F2 / #FFFFFF in light mode. Existing neutral and semantic colors are unchanged.

## Measured contrast

WCAG sRGB luminance calculations, rounded to two decimals:

| Pair | Ratio |
| --- | --- |
| Lime on dark background | 13.46:1 |
| Lime on dark surface | 12.90:1 |
| Near-black label on lime | 13.46:1 |
| Olive text or border on cream | 7.29:1 |
| Olive text or border on white | 7.88:1 |
| Olive border against lime | 5.39:1 |
| Lime fill against cream | 1.35:1 |
| Lime fill against white | 1.46:1 |

The last two pairs do not meet the UI boundary threshold by themselves. A one-pixel olive perimeter supplies the distinguishable boundary. Tests move the former fill-edge checks to the actual boundary token and retain the 3:1 threshold, plus 4.5:1 label tests. Hover boundaries, opacity-hover labels, focus, tinted badges, 80%-opacity links and vibe washes are still tested. Body and large-text roles are checked on both surfaces in both themes.

The suggested #4D6B00 is 5.68:1 on cream at full opacity but only 3.75:1 in the existing 80%-opacity text treatment. Retaining #375B0D keeps that existing treatment at or above 4.5:1 without changing typography or removing assertions.

## Files and assets

- `src/lib/design-tokens.ts` and `src/app/globals.css`: mirrored boundary token and light primary fill.
- Shared Button, StartAction, CreateInSpotifyButton, PlaybackButton, ChatInput and playlist-page controls: consistent token-based borders and existing near-black labels.
- `src/lib/design-tokens.test.ts`: updated boundary-role assertions, new control-class guards, expanded text-role coverage.
- `tests/e2e/brand.spec.ts`: 375px and 1440px in both themes, including primary fill, label and border assertions.
- Design-system guide and decisions log: explain the fill-versus-boundary rule and retained olive.

Ran the existing `node scripts/generate-icons.js`. Favicon SVG, dark variant, PNG sizes 16/32/48/180/192/512, ICO, maskable 192/512, static brand SVGs and manifest were regenerated. They are byte-identical to the baseline and therefore have no Git changes. The required lime rounded square and near-black lowercase m already existed. Manifest theme_color and metadata use the existing lime token. The light wordmark dot remains olive for contrast; the dark dot remains lime. Font files, imports, weights and SVG paths are untouched.

A case-insensitive scan found no known old brand-blue literals (#2F5BEA, #5B9BFF, #174CB4) or blue palette utilities in current source, public assets and scripts. Historical documentation is not production color usage. Neutral grays were intentionally retained.

## Executed checks

- Typecheck: passed.
- Lint: zero errors, seven existing image warnings.
- Full Vitest: 100 files, 634 tests passed, including token, contrast and generated-asset assertions.
- Production build: passed.
- Icon generation: passed; no asset drift.
- Diff whitespace check: passed.
- Playwright brand checks: blocked at Chromium launch. One launch failure; remaining three cases did not run. No screenshots or axe results were produced.

Both-theme browser appearance at 375px and 1440px is unverified. There is no real-phone keyboard or touch validation. Existing automated contrast assertions do not prove every rendered combination across the application. No new dependency or secret configuration is needed.

## Phone review

Use the Preview link on PR 12 after Vercel reports the Stage 2 commit ready.

1. Open Display and switch between dark and light.
2. In light mode, check that primary actions have lime fills, dark labels and a visible thin olive border. Check Start, chat Send, and tester playback or playlist actions where available.
3. Confirm small links, icons and focus indicators are olive rather than bright lime on cream or white.
4. In dark mode, check the lime accent and near-black action labels.
5. Confirm the wordmark and fonts look unchanged, with no clipped controls at narrow width.
6. Check Lite mode and revisit the mobile account and track sheets for regressions.

Visual rendering, border visibility and device behavior need this preview review. No local commands or installations are required. Stop after review; do not merge without explicit approval.
