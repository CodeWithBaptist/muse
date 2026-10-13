# Mobile layout Stage 1 report

Date: 13 October 2026.

## Scope and environment

The interrupted mobile changes were preserved and completed. No new dependency, font family, font asset, font import, weight, wordmark outline, homepage redesign or accent change was introduced. Existing lime colors predate this task. Stage 2 remains locked.

Filesystem and terminal work. Node 22.22.3, npm 10.9.8 and dependencies are installed. GitHub origin is accessible and PR 12 is open. The session is fixed to `arena/f36706d9-muse`, so the requested independent `mobile-layout` branch is unavailable. PR 12 also contains earlier guest, branding and share work; it is not a mobile-only PR. Nothing is merged or pushed to main.

Network access is limited to GitHub and package registries. Playwright 1.63.0 and axe are installed. Chromium is missing and its download host is outside the available network. There is no real phone or software keyboard test device. No secrets were inspected or requested.

## Initial shell audit

| Component | Existing behavior | Gap addressed |
| --- | --- | --- |
| `shell/BottomTabs.tsx` | Fixed below 768px, shared navigation source, guest Chat/Profile and six tester links, icons, labels, current-page state, 44px targets, safe area | Reserve combined tabs and mini-player space consistently |
| `shell/TopBar.tsx` | Below 768px, wordmark, Display and tester Settings | Add direct account access and logout |
| `shell/Sidebar.tsx` | From 768px, guest/tester navigation and tester logout | Wrap connection status instead of clipping |
| `shell/NowPlayingStrip.tsx` | Tester selected or playing tracks below 1280px | Tap to reopen details, preserve playback and selection |
| `shell/NowPlaying.tsx` | Tester rail from 1280px | Reuse content inside compact details sheet |
| `chat/TrackDetails.tsx` | Catalogue rail from 1280px and independent mobile dialog | Shared sheet and tester catalogue selection support |
| `shell/DisplayMenu.tsx` | Floating UI collision handling and separate sheet below 640px | Reuse shared sheet and preference controls |

Phone logout was already available inside Settings. The new account sheet adds direct access; it does not create another auth implementation. Guest Settings is not supported, so guests receive no Settings link, Spotify status or logout.

DisplayMenu is the floating-menu implementation found in the audit. Other history panels, disclosures and segmented controls are inline. Native title tooltips are browser-positioned. Existing Floating UI flip, shift and size handling remains above 640px.

## Implementation and file groups

- `components/ui/BottomSheet.tsx`: native modal dialog, associated title, initial and return focus, explicit keyboard cycling, Escape, Close, backdrop, handle swipe, reference-counted body lock, safe-area padding and scrollable 85dvh panel. Uses existing motion tokens, with instant Lite and reduced-motion behavior.
- `components/shell/AccountSheet.tsx`, `TopBar.tsx`, `DisplayMenu.tsx`: real account state, existing logout and shared display preferences. Guest/tester distinctions remain intact.
- `AppShell.tsx`, `NowPlaying.tsx`, `NowPlayingStrip.tsx`, `chat/TrackDetails.tsx`, `TrackRow.tsx`, `RecommendationList.tsx`, `hooks/use-now-playing.tsx`, `use-media-query.ts`: shared detail content, compact inspection, mini-player reopening and focus restoration. Catalogue selections do not revive a stale player sheet.
- `globals.css`: `--muse-bottom-space` combines measured mini-player height and safe-area-aware tab height. The page column reserves it and nested scroll containers inherit it as scroll padding. No duplicate per-page bottom padding. Sidebar and desktop rail breakpoints remain unchanged.
- `hooks/use-chat-viewport.ts`, `ChatInput.tsx`, chat page: touch focus hides chrome below 1280px, blur and unmount restore it, VisualViewport sizes the shell, and latest-message scrolling follows viewport changes. Composer text is 16px to avoid small-input phone auto-zoom; font identity and weights are unchanged.
- Chat, Discover, Profile, Settings, Privacy, AI provider, auth error handling, Spotify sign-in API and billing message constants: plain visitor copy with existing availability codes and classification preserved. Privacy hashing disclosure remains accurate without a configuration name.
- `lib/visitor-copy.ts` and tests: legacy message sanitation, JSX scanning and missing-AI API response guards. Both the requested environment-name pattern and a multipart-name pattern are covered.
- Unit and API tests, `test/setup.ts`, and Playwright specs: updated exact-copy assertions, sheet and account interactions, track integration and keyboard logic. JSDOM receives a test-only dialog shim; this does not verify native browser top-layer behavior.
- `docs/DECISIONS.md`, `DESIGN-SYSTEM.md`, and Privacy inventory: record layout contracts and keep the legal inventory synchronized.

## Verification

Fresh checks after resuming this task:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, zero errors and seven existing image warnings |
| `npm run test` | Passed, 100 files and 632 tests |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| Playwright mobile-layout and navigation specs | Blocked at launch by missing Chromium; one launch failure, 32 tests not run |
| axe | Included in browser specs, but not executed because Chromium is missing |

The browser matrix includes 360, 390, 430, 768, 1024, 1280 and 1440px, guests and testers, and both current themes. Its assertions are prepared, not verified results. Existing token contrast tests pass as part of Vitest; rendered-state contrast is not independently browser-verified.

Unverified: real phone keyboard and safe areas, swipe behavior on physical devices, native top-layer isolation, visual clipping and responsive layout, and live Spotify/AI services. Test fixtures are confined to tests; production integrations were not replaced.

## Browser-only phone review

Use the current Preview link on PR 12 after Vercel reports the mobile commit ready. Check the deployment commit rather than assuming an earlier ready preview contains these changes.

### iOS Safari

1. Check guest Chat and Profile tabs, no sideways scrolling, and readable content above the bottom bar.
2. Open Account. Confirm Guest and local-chat text, theme and Lite, but no Spotify status or logout. Sign in as an existing tester and check display name, Spotify connected, Settings and logout.
3. Open and close Account and Display using Close and the backdrop. Scroll long sheet content. With VoiceOver or an external keyboard, check title announcement, contained focus and return focus.
4. Tap a recommendation. For tester playback tracks, close details and reopen them from the mini player. Selection and playback should persist.
5. Focus chat with the keyboard open. Input and latest message should remain visible; tabs and mini player should hide. Move focus away and verify navigation returns. Also check keyboard dismissal without blur, because focus may remain on the input until you tap elsewhere.
6. Rotate the phone and repeat in light, dark and Lite modes.

### Android Chrome

Repeat the above. Also swipe down from the sheet handle, check Display stays within the viewport, and check Back-key keyboard dismissal followed by tapping outside the composer restores navigation.

Physical keyboard resizing, browser safe areas, touch swipes, screen-reader behavior and visual overflow require this manual review. No local commands, installations or secret changes are needed.

## Stage gate

Review only. Do not merge without approval. Do not begin accent work until the owner says `Continue to Stage 2`.
