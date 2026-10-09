# MUSE design system

The working rules for building MUSE screens. Tokens live in `src/app/globals.css` (source of truth for rendering) and are mirrored in `src/lib/design-tokens.ts` for TypeScript; a unit test keeps the two in step. In development, `/design-system` renders every token and primitive from the real components. The route returns 404 in production builds.

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
| `--color-accent`          | `#5B9BFF` dark, `#174CB4` light | Links, highlights, focus, playing state                                         |
| `--color-accent-primary`  | `#2F5BEA`                       | Primary action fills                                                            |
| `--color-accent-contrast` | `#FFFFFF`                       | Text and icons on primary action fills                                          |
| `--color-danger`          | `#E8705F`                       | Error text, invalid field edges, destructive confirmation. Never decorative     |

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
