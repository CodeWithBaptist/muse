# Guest launch checks

Date: 13 October 2026.

## Scope

Guest-only public launch preparation. Navigation for a visitor without a Spotify connection, guest saved lists on the device, removal of guest account surfaces, a mailto feedback link, and the guest track panel. No account system was added, no dependency, environment variable, database table, API route, or color token changed, and no other behaviour was touched.

Terminology in this report: "guest" means a visitor without a Spotify connection (the only accounts MUSE has). "Tester" means a visitor who signed in with Spotify.

## What changed

| Area | Change |
| --- | --- |
| `components/shell/shell-nav.ts` | Added `GUEST_HOME_PATH` and `GUEST_HIDDEN_LABELS`. `navItemsFor` still returns Chat and Profile for a guest and every destination for a tester. |
| `components/shell/AppShell.tsx` | A guest on any route that is not open is sent to `/chat` with `router.replace`, and no page body is rendered until the redirect has happened. |
| `components/shell/Sidebar.tsx` | The identity chip, Settings link, and Log out render only for a tester. |
| `components/shell/TopBar.tsx` | The phone header draws Display settings only for a guest; the account chip and Settings link are tester-only. |
| `components/shell/AccountSheet.tsx` | Returns nothing for a guest. The tester sheet is unchanged. |
| `lib/auth-flow.ts`, `lib/auth-flow.test.ts` | Removed `loginPathForReturn`, which nothing calls once the guest redirect points at Chat. The rest of the sign-in flow, including `safeNextPath` and `loginPathForError`, is untouched. |
| `lib/guest-saved-store.ts` (new) | Guest saved lists in localStorage under `muse.saved.lists.v1`, newest 20, with an in-memory fallback, tolerant parsing, dedupe by title and songs, delete, and clear all. |
| `components/chat/SavedOnDevice.tsx` (new) | The "Saved on this device" control and panel, with the plain note, per list Copy, Text, CSV, Share, six open-in links, Delete, and Clear all. |
| `hooks/use-chat.ts` | A guest's generated list is saved as it arrives. The chat itself is unchanged. |
| `components/chat/TrackDetails.tsx` | The six open-in links keep their order and now carry `data-open-in` and a descriptive label. No playback text is added; the panel never had any. |
| `lib/feedback.ts`, `components/support/SendFeedbackLink.tsx` (new) | One mailto to the contact already in `src/lib/legal.ts`, with the prefilled subject `MUSE feedback`, drawn in the landing footer and the chat header. Nothing else is loaded. |
| `app/privacy/page.tsx`, `docs/stage-share-privacy-inventory.md` | The new key, what it holds, and the Delete and Clear all controls. |
| `tests/e2e/guest-launch.spec.ts` (new) | The guest and tester flows at 360px and 390px, prepared. |

## Storage keys for the Privacy page

The guest browser storage keys, as they exist in the code after this change:

| Key | What it holds | Written by |
| --- | --- | --- |
| `muse.chat.local.v1` | The last 40 messages of the guest conversation. | `src/lib/guest-chat-store.ts` |
| `muse.saved.lists.v1` | Up to 20 generated lists with their songs and the time each was saved. | `src/lib/guest-saved-store.ts` |
| `muse.chat.prefs.v1` | Scope (Nigeria or Global) and language choice. | `src/lib/chat-preferences-store.ts` |
| `muse.ui.prefs.v1` | Theme and Lite mode. | `src/lib/ui-prefs.ts` |
| `muse.taste.v1` | The taste snapshot, when one is added on Profile. | `src/lib/taste/store.ts` |

A test in `src/app/legal-pages.test.tsx` reads each key from its source file and fails if the Privacy Policy does not name it, so the page cannot drift from the code.

## Verification

Executed here:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, zero errors and the same seven pre-existing image warnings |
| `npm run test` | Passed, 104 files and 662 tests |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| `npx prettier --list-different .` | 73 files, all of them unchanged by this work and already unformatted before it; none of the files touched here are listed |
| Server-rendered guest HTML over HTTP | `/chat` and `/profile` return the page; `/library`, `/discover`, `/playlists`, and `/settings` return only the shell loading state, so no hidden page content is sent to a guest |
| Guest strings in that HTML | No `Sign in`, `Create account`, `Log out`, or `Guest` text on any route |

Browser tests are blocked: Playwright 1.63.0 is installed, but Chromium is not, and its download host is outside the available network, as in the earlier stages. Running `tests/e2e/guest-launch.spec.ts` against the local dev server collects all nine cases and fails them all at browser launch (`Executable doesn't exist`, `npx playwright install`), before any assertion runs; the spec file is written and unexecuted. axe-core runs inside those specs, so it is also unexecuted; accessibility assertions were covered here only by the jsdom component tests.

The guest flow was verified in jsdom through the real chat page instead (`src/components/chat/guest-saving.test.tsx`): a list arrives, it is written to `muse.saved.lists.v1`, the panel opens, the note reads "Saved items live in this browser and disappear if you clear your browser data.", copy writes the numbered text through the clipboard API, the CSV download is triggered with the right file name, the six open-in links all appear, Delete removes the list, and Clear all empties the store. The shell redirect and the hidden pages are covered in `src/components/shell/AppShell.test.tsx`.

## Not verified here, and what to look at in a browser

* Real phone widths, safe areas, and the software keyboard with the new header controls. The chat header now wraps (`flex-wrap` on the left group) so the on-device note and the saved-list control stack instead of overflowing 360px; this is asserted only in jsdom, not in a rendered browser.
* Copy on a real clipboard, the text and CSV downloads, and the share sheet or WhatsApp fallback on a phone.
* The client-side redirect from a hidden route: jsdom covers the redirect call and the absence of page content, but not a real navigation.
* The tester surface end to end: the tester cases in `tests/e2e/guest-launch.spec.ts` assert six tabs, the account sheet with Settings and Log out, the Spotify-backed reply with the mini player, and `/library`, `/playlists`, and `/settings` loading for a tester.
* Live data: Spotify, OpenAI, Deezer, and iTunes were not contacted, and the browser suite keeps its `/api` mocks.

## Open questions for the owner

1. Should the hidden routes redirect on the server as well, so a guest with JavaScript disabled sees nothing rather than a loading state? This stage keeps the redirect in the shell because every page in the app already needs JavaScript, and a server redirect would make four static routes dynamic and add a database read per request.
2. `/plus` is still reachable by a guest and still says Plus is not open. It is not in the navigation and it was outside this request, so it was left alone.
3. The guest saved-list limit is 20 lists. The privacy line says "up to 20 of the most recent"; change both if a different number is wanted.
4. The feedback subject is the fixed string `MUSE feedback`. It is not prefilled with the page or the browser, since that would mean reading and sending more than the visitor typed.
