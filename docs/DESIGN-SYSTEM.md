# MUSE design system

The working rules for building MUSE screens. Tokens live in `src/app/globals.css` (source of truth for rendering) and are mirrored in `src/lib/design-tokens.ts` for TypeScript; a unit test keeps the two in step. In development, `/design-system` renders every token and primitive from the real components. The route returns 404 in production unless the operator explicitly sets `SHOW_DESIGN_SYSTEM=true`. It remains noindex and is excluded from the sitemap.

## Color

| Token                     | Value                           | Use                                                                             |
| ------------------------- | ------------------------------- | ------------------------------------------------------------------------------- |
| `--color-background`      | `#0B0B0C`                       | Page stage                                                                      |
| `--color-surface`         | `#111113`                       | Raised areas: fields, sidebar, sheets                                           |
| `--color-border-subtle`   | `#232326`                       | Hairlines. Structure only, never meaning                                        |
| `--color-border-strong`   | `#34343A`                       | Outlined controls, hover edges                                                  |
| `--color-text-primary`    | `#F2F1ED`                       | Body, titles, control labels                                                    |
| `--color-text-secondary`  | `#A1A1A8`                       | Supporting copy, meta                                                           |
| `--color-text-muted`      | `#85858C`                       | Labels, placeholders, hints. The darkest tone allowed for small text (5.4:1)    |
| `--color-text-faint`      | `#6B6B73`                       | Large text (24px, or 19px bold), disabled text, decorative details only (3.7:1) |
| `--color-accent`          | `#A8E85C` dark, `#375B0D` light | Links, highlights, focus, playing state                                         |
| `--color-accent-primary`  | `#A8E85C` in both themes | Primary action fills                                                            |
| `--color-accent-contrast` | `#0B0B0C`                       | Text and icons on primary action fills                                          |
| `--color-danger`          | `#E8705F`                       | Error text, invalid field edges, destructive confirmation. Never decorative     |

The brand accent is lime. Light-theme links deepen to `#375B0D` so existing 80% text opacity and tinted badges remain readable. Primary fills use `#A8E85C` with `#0B0B0C` labels in both themes. The new `--color-accent-boundary` is lime on dark surfaces and olive on light surfaces. Every primary control has a one-pixel border, including standalone send, playback and playlist controls.

| Pair | Contrast |
| --- | --- |
| Dark lime on background / surface | 13.46:1 / 12.90:1 |
| Light olive text or border on background / surface | 7.29:1 / 7.88:1 |
| Near-black text on lime fill | 13.46:1 |
| Olive border against lime fill | 5.39:1 |
| Lime fill against cream / white | 1.35:1 / 1.46:1, requires the olive border |

Vibe washes use the lime and green tokens, not ad hoc colors. Landing canvases, focus rings, logo dots, charts, highlights and metadata already consume the shared tokens. Static SVGs and the manifest are synchronized by `node scripts/generate-icons.js`; that script also regenerates all favicon PNG sizes, the ICO and both opaque maskable sizes without changing glyph geometry. Asset tests prevent token drift. Accent contrast tests cover both base surfaces, primary hover, selection, tinted badges, the 80% accent label and the full-effects vibe wash. Decorative faint borders and disabled controls are not text contrast claims.

Rules:

- Do not use Tailwind palette colors (`red-400`, `zinc-500`, and so on) in product screens. Use the tokens. Existing `red-*` usages migrate to `danger` as each screen is revisited.
- Hairline borders fall below the 3:1 non-text minimum by design. Anything a user must identify (a field, a selected tab, a playing row) also has a non-hairline cue: text, weight, the accent, or an icon.
- The accent is a signal, not a theme. If a screen has two accent fills, one of them is wrong.

## Typography

Fredoka Variable (interface) and Bagel Fat One (display), by product decision. Neither ships tabular figures; use the `tabular-nums` utility for durations and counts, which reserves a fixed minimum width per number.

| Utility              | Size              | Where                              |
| -------------------- | ----------------- | ---------------------------------- |
| `type-display`       | clamp per section | Landing hero and section headlines |
| `type-page-title`    | 32px to 44px      | Page titles inside the app         |
| `type-heading`       | 20px              | Section titles inside a page       |
| `type-body`          | 15px / 1.6        | Conversation and reading copy      |
| `type-caption`       | 14px              | Supporting lines and hints         |
| `type-section-label` | 12px uppercase    | Eyebrow labels and tabs            |
| `type-meta`          | 12px              | Durations, counts, timestamps      |

Nothing readable goes below 12px. Reading copy stays within `max-w-prose` or `max-w-reading` (44rem).

## Spacing and shape

- 8px grid. Use Tailwind's even steps (`2, 4, 6, 8, 12, 16, ...`). Odd steps (`1, 3`) are for optical alignment of icons only.
- Radii: `rounded-xs` 2px, `rounded-sm` 4px, `rounded-md` 6px (buttons, fields, small surfaces), `rounded-lg` 8px (larger containers). 12px and above (`rounded-xl`, `rounded-2xl`) are reserved for artwork tiles and bottom sheets.
- Minimum pointer target: 40px on every interactive element, including icon buttons. Make the hit area larger than the glyph rather than the glyph larger.
- Structure comes from alignment, whitespace, and hairlines. A box or card needs a reason.

## Primitives

- `Button` (`src/components/ui/Button.tsx`): `primary`, `secondary`, `outline`, `ghost`; sizes `sm` 40px, `md` 44px, `lg` 48px. `loading` disables the control, sets `aria-busy`, and shows the equalizer; set it only while a real request is running and change the label to say what is happening. `buttonVariants()` gives links the same classes.
- `Input`, `Textarea` (`src/components/ui/Input.tsx`, `Textarea.tsx`): shared field styling through `fieldClasses`. Invalid fields get the danger edge through `aria-invalid`.
- `Field`, `Label` (`src/components/ui/Field.tsx`): wires label, hint, and error to the control with ids and aria attributes. Errors render with `role="alert"` and replace the hint.
- `Surface` (`src/components/ui/Surface.tsx`): existing raised and flat containers.
- `EqualizerBars` (`src/components/motion/EqualizerBars.tsx`): moves only while something is loading or playing.

## Focus

Defined once in the base layer:

- Links, buttons, summaries, `[role="button"]`, and anything with `tabindex`: a 2px accent outline with a 2px offset on `:focus-visible`.
- Inputs, selects, textareas: no outline; the border becomes the accent and a 1px accent shadow makes a 2px edge.

A component may refine its indicator (the chat composer softens its edge) but must never remove it without supplying another. Do not add `outline-none` to a control that has no replacement ring.

## Motion

Tokens: `--duration-instant` 90ms, `fast` 140ms, `base` 220ms, `slow` 360ms, `scene` 600ms; `--ease-standard` and `--ease-emphasized`; one spring (stiffness 260, damping 30) exported from `src/lib/motion.ts`.

- Animate `transform` and `opacity`. Width, height, top, and left only when there is no alternative.
- Staggers run 30ms to 50ms apart and never longer than 400ms in total; `staggerDelay()` enforces both.
- Every screen has about one primary attention animation. Decorative loops (equalizers) run only while something is happening and stop when paused.
- Respect `prefers-reduced-motion`: movement becomes a fade or an instant change, decorative loops stop, and no state depends on motion to be understood. Use `useReducedMotion()` in components and the media query in CSS.
- The existing landing and product animations are kept; new motion extends them.

## Layout

Tokens: `--muse-sidebar-width` 240px, `--muse-now-playing-width` 280px, `--muse-topbar-height` 64px, `--muse-bottom-nav-height` 64px, `--muse-header-height` 64px, `--muse-safe-bottom` and `--muse-safe-top` (safe-area insets; the viewport is `cover`).

Breakpoints are Tailwind's defaults. The shell (`src/components/shell/AppShell.tsx`) fills the visible viewport (`.muse-shell`, `100dvh`): the sidebar, the page column, and the Now Playing rail. Below `md`, a fixed bottom tab bar reserves space in the shell, includes the safe area, and follows the visual viewport while the keyboard is open. The display popover uses Floating UI collision middleware, and below 640px it becomes a bottom sheet.

- below `md` (768px): phone. Top bar, scrolling page, Now Playing strip when a track is selected, fixed bottom tabs with 44px targets. Signed-in users see Chat, Discover, Library, Playlists, Profile, and Settings. Guests see Chat and Profile.
- `md` (768px) and up: sidebar, page, and Now Playing strip when a track is selected.
- `xl` (1280px) and up: desktop. Sidebar, page, Now Playing rail.

Destinations live in `src/components/shell/shell-nav.ts`; `isActivePath` treats nested routes as part of their section. On route change the page cross fades with `pageTransition` (or `pageTransitionReduced`) and focus moves to the `main` landmark.

Mobile layouts are composed for the phone, not shrunk from the desktop.

## Checking a screen

Before a screen is called done: desktop, tablet, and mobile widths; keyboard only; reduced motion on; loading, empty, and error states; and the anti-vibecode questions in the master specification. Every number shown comes from real data.


## Mobile-layout Stage 1 contract

- Below 768px: existing TopBar and BottomTabs. Account opens shared identity, display and tester account actions. Logout also remains available in Settings.
- At 768px and above: existing Sidebar. Status text wraps rather than truncating the connection state.
- Below 1280px: track detail sheets and the tester's collapsed mini player. At 1280px and above: the same detail content in the right rail. Catalogue recommendations work for guests and testers.
- `--muse-bottom-space` combines tabs, safe area and measured player height. The page column reserves that space for every page, including chat; nested scroll containers inherit it as scroll padding. No per-page bottom offsets are needed.
- `BottomSheet` owns modal semantics, initial and return focus, keyboard cycling, scroll lock, Escape, Close, backdrop and downward handle swipe dismissal. Its content scrolls within 85dvh, with bottom safe-area padding. The panel uses existing base-duration and standard-easing tokens for opacity and translation only; Lite and reduced motion disable animation.
- Display is the sole floating menu. Below 640px it uses `BottomSheet`; otherwise Floating UI flips, shifts and sizes within 16px viewport margins. Inline disclosure, history and segmented controls remain inline, not floating menus.
- Touch focus in the chat composer hides tabs and the mini player below 1280px, restores them on blur and follows the visual viewport where supported. This is focus intent, not proof that a physical keyboard is open. Composer text is 16px to avoid small-input auto-zoom on phones.
- Missing configuration never becomes visitor setup instructions. Preserve response codes and legacy classification, but use plain Chat and Discover availability messages. The visitor-copy guard checks JSX and legacy error sanitation; API tests check missing-AI response bodies.

Browser layout, native top-layer focus isolation and physical phone keyboard behavior still require preview review. Unit tests use a test-only native-dialog shim, which does not simulate a browser top layer. No palette, icon, manifest or accent change belongs to this mobile stage.


## Stage 2 lime fill and boundary contract

Primary fills use `#A8E85C` in both themes, with `#0B0B0C` labels. Light-theme text, icons, focus rings and small accents use `#375B0D`, never bright lime on paper. The suggested `#4D6B00` fails the existing 80%-opacity text state, so the darker existing olive is retained.

Every primary control has a one-pixel `border-accent-boundary`: lime in dark mode, olive in light mode. Apply this to standalone controls as well as the shared Button. The light fill itself does not meet 3:1 against white; the visible perimeter does. Contrast tests therefore check the actual boundary token at normal and opacity-hover states, rather than incorrectly requiring a decorative fill to supply the boundary. Label, focus, tinted-state and opacity checks remain in place.

The icon generator was rerun for all sizes, ICO and maskable icons. Output was identical because those assets already use the required lime square and near-black lowercase m. Metadata and manifest already use the correct accent. No font, weight, import or wordmark geometry changed. Earlier dated palette entries describe historical decisions; this section supersedes the former light primary fill.
