'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { Button, buttonVariants } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Field } from '@/components/ui/Field';
import { EqualizerBars } from '@/components/motion/EqualizerBars';
import {
  breakpoints,
  colors,
  colorVariables,
  durations as durationTokens,
  easings as easingTokens,
  layout,
  radii,
  spacingSteps,
  MIN_TOUCH_TARGET,
  type ColorToken,
} from '@/lib/design-tokens';
import { contrastRatio, formatRatio, meetsAA } from '@/lib/color';
import { durations, easings, staggerDelay } from '@/lib/motion';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------------- */
/* Shared pieces                                                              */
/* ------------------------------------------------------------------------- */

function Section({
  id,
  title,
  lede,
  children,
}: {
  id: string;
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="grid gap-6 border-t border-border-subtle py-10 md:grid-cols-[200px_minmax(0,1fr)] md:gap-12 md:py-14"
    >
      <div>
        <h2 id={`${id}-title`} className="type-heading">
          {title}
        </h2>
        <p className="type-body mt-2 text-text-secondary">{lede}</p>
      </div>
      <div className="min-w-0 space-y-8">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="type-caption max-w-prose">{children}</p>;
}

/* ------------------------------------------------------------------------- */
/* Color                                                                      */
/* ------------------------------------------------------------------------- */

const TEXT_TOKENS: Array<{
  token: ColorToken;
  use: 'text' | 'large-text' | 'ui';
  role: string;
}> = [
  { token: 'textPrimary', use: 'text', role: 'Body, titles, controls' },
  { token: 'textSecondary', use: 'text', role: 'Supporting copy, meta' },
  { token: 'textMuted', use: 'text', role: 'Labels, placeholders, hints' },
  {
    token: 'textFaint',
    use: 'large-text',
    role: 'Large or disabled text, details',
  },
  {
    token: 'accent',
    use: 'text',
    role: 'Links, highlights, focus, playing',
  },
  {
    token: 'accentPrimary',
    use: 'ui',
    role: 'Cobalt primary action fill',
  },
  {
    token: 'accentContrast',
    use: 'text',
    role: 'Text and icons on primary actions',
  },
  { token: 'danger', use: 'text', role: 'Errors and destructive confirmation' },
];

const SURFACE_TOKENS: ColorToken[] = [
  'background',
  'surface',
  'borderSubtle',
  'borderStrong',
];

function ColorSection() {
  return (
    <Section
      id="color"
      title="Color"
      lede="A near-black stage, warm off-white text, and a compact palette of cobalt actions and azure highlights. Ratios are computed from the tokens, not typed in."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <caption className="sr-only">
            Color roles with contrast ratios on the background and surface
            colors
          </caption>
          <thead>
            <tr className="type-section-label">
              <th scope="col" className="pb-3 font-semibold">
                Token
              </th>
              <th scope="col" className="pb-3 font-semibold">
                Role
              </th>
              <th scope="col" className="pb-3 font-semibold">
                On background
              </th>
              <th scope="col" className="pb-3 font-semibold">
                On surface
              </th>
            </tr>
          </thead>
          <tbody>
            {TEXT_TOKENS.map(({ token, use, role }) => {
              const hex = colors[token];
              const onBackground = contrastRatio(hex, colors.background);
              const onSurface = contrastRatio(hex, colors.surface);
              return (
                <tr key={token} className="border-t border-border-subtle">
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="h-6 w-6 shrink-0 rounded-sm border border-border-subtle"
                        style={{ backgroundColor: hex }}
                      />
                      <span className="flex flex-col">
                        <code className="text-text-primary">
                          {colorVariables[token]}
                        </code>
                        <span className="type-meta uppercase">{hex}</span>
                      </span>
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-text-secondary">{role}</td>
                  <td className="py-3 pr-4 tabular-nums">
                    <ContrastCell
                      ratio={onBackground}
                      use={use}
                      hex={hex}
                      background={colors.background}
                    />
                  </td>
                  <td className="py-3 tabular-nums">
                    <ContrastCell
                      ratio={onSurface}
                      use={use}
                      hex={hex}
                      background={colors.surface}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Row>
        {SURFACE_TOKENS.map((token) => (
          <div key={token} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="h-10 w-10 rounded-md border border-border-strong"
              style={{ backgroundColor: colors[token] }}
            />
            <span className="flex flex-col">
              <code className="text-sm text-text-primary">
                {colorVariables[token]}
              </code>
              <span className="type-meta uppercase">{colors[token]}</span>
            </span>
          </div>
        ))}
      </Row>

      <Note>
        Hairline borders are structure, not meaning: the subtle border sits at{' '}
        {formatRatio(contrastRatio(colors.borderSubtle, colors.background))} on
        the background, below the 3:1 non-text minimum, so nothing is identified
        by a hairline alone. A focused field switches to the accent edge at{' '}
        {formatRatio(contrastRatio(colors.accent, colors.background))}.
      </Note>
    </Section>
  );
}

function ContrastCell({
  ratio,
  use,
  hex,
  background,
}: {
  ratio: number;
  use: 'text' | 'large-text' | 'ui';
  hex: string;
  background: string;
}) {
  const passes = meetsAA(hex, background, use);
  const label =
    use === 'text'
      ? 'AA text'
      : use === 'large-text'
        ? 'AA large text'
        : 'AA UI';
  return (
    <span className="flex items-center gap-2">
      <span
        className="inline-flex h-7 items-center rounded-sm px-2 text-xs font-semibold"
        style={{ backgroundColor: background, color: hex }}
      >
        Aa
      </span>
      <span className="text-text-primary">{formatRatio(ratio)}</span>
      <span
        className={cn(
          'type-meta',
          passes ? 'text-text-secondary' : 'text-danger',
        )}
      >
        {passes ? label : `below ${label}`}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------------- */
/* Typography                                                                 */
/* ------------------------------------------------------------------------- */

const TYPE_SCALE: Array<{ utility: string; sample: string; where: string }> = [
  {
    utility: 'type-display',
    sample: 'Your music, understood.',
    where: 'Landing hero and section headlines',
  },
  {
    utility: 'type-page-title',
    sample: 'Say the vibe.',
    where: 'Page titles inside the app',
  },
  {
    utility: 'type-heading',
    sample: 'Outside your usual rotation',
    where: 'Section titles inside a page',
  },
  {
    utility: 'type-body',
    sample:
      'Something like Rema, but calmer. Smooth production, less club, more late night.',
    where: 'Conversation and reading copy',
  },
  {
    utility: 'type-caption',
    sample: 'Playing because you asked for: late night, smooth.',
    where: 'Supporting lines and hints',
  },
  {
    utility: 'type-section-label',
    sample: 'Because you listen to',
    where: 'Eyebrow labels and tabs',
  },
  {
    utility: 'type-meta',
    sample: '3:42  Afrobeats  2024',
    where: 'Durations, counts, timestamps',
  },
];

function TypographySection() {
  return (
    <Section
      id="typography"
      title="Typography"
      lede="Fredoka Variable for the interface and Bagel Fat One for display, by product decision. Hierarchy comes from size and weight; color changes are reserved for secondary and muted levels."
    >
      <dl className="divide-y divide-border-subtle">
        {TYPE_SCALE.map(({ utility, sample, where }) => (
          <div
            key={utility}
            className="grid gap-2 py-5 md:grid-cols-[180px_minmax(0,1fr)] md:gap-8"
          >
            <dt className="flex flex-col gap-1">
              <code className="text-sm text-text-primary">.{utility}</code>
              <span className="type-meta">{where}</span>
            </dt>
            <dd
              className={cn(
                utility,
                utility === 'type-display' && 'text-[clamp(32px,5vw,56px)]',
              )}
            >
              {sample}
            </dd>
          </div>
        ))}
      </dl>
      <Note>
        Neither typeface ships tabular figures, so durations use the{' '}
        <code>tabular-nums</code> utility, which reserves a fixed minimum width
        per number instead of relying on the font. Line length stays under{' '}
        <code>max-w-prose</code> for reading copy.
      </Note>
    </Section>
  );
}

/* ------------------------------------------------------------------------- */
/* Spacing and radius                                                         */
/* ------------------------------------------------------------------------- */

function SpacingSection() {
  return (
    <Section
      id="spacing"
      title="Spacing and shape"
      lede="An 8px grid expressed through Tailwind's even steps. Odd steps are for optical alignment of icons only. Corners stay between 2px and 6px on controls."
    >
      <ul className="flex flex-wrap items-end gap-4" aria-label="Spacing steps">
        {spacingSteps.map((step) => (
          <li key={step} className="flex flex-col items-center gap-2">
            <span
              aria-hidden="true"
              className="block w-6 bg-border-strong"
              style={{ height: step * 4 }}
            />
            <span className="type-meta">
              {step} <span className="text-text-faint">{step * 4}px</span>
            </span>
          </li>
        ))}
      </ul>

      <Row>
        {(Object.keys(radii) as Array<keyof typeof radii>).map((key) => (
          <div key={key} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="block h-12 w-16 border border-border-strong bg-surface"
              style={{ borderRadius: radii[key] }}
            />
            <span className="flex flex-col">
              <code className="text-sm text-text-primary">rounded-{key}</code>
              <span className="type-meta">{radii[key]}px</span>
            </span>
          </div>
        ))}
      </Row>

      <Note>
        Minimum pointer target is {MIN_TOUCH_TARGET}px. Larger radii (12px and
        up) are reserved for artwork tiles and bottom sheets, never for buttons
        or fields.
      </Note>
    </Section>
  );
}

/* ------------------------------------------------------------------------- */
/* Buttons                                                                    */
/* ------------------------------------------------------------------------- */

function ButtonsSection() {
  const [previewLoading, setPreviewLoading] = React.useState(false);

  return (
    <Section
      id="buttons"
      title="Buttons"
      lede="One primary action per view in the accent. Everything else is secondary, outline, or ghost. Hover lifts one pixel on the shared spring; pressing settles it back."
    >
      <div className="space-y-5">
        {(['sm', 'md', 'lg'] as const).map((size) => (
          <Row key={size}>
            <span className="type-meta w-8">{size}</span>
            <Button size={size} variant="primary">
              Connect Spotify
            </Button>
            <Button size={size} variant="secondary">
              Save
            </Button>
            <Button size={size} variant="outline">
              Edit
            </Button>
            <Button size={size} variant="ghost">
              Start over
            </Button>
          </Row>
        ))}
      </div>

      <Row>
        <span className="type-meta w-8">state</span>
        <Button disabled>Disabled</Button>
        <Button variant="secondary" loading={previewLoading}>
          {previewLoading ? 'Creating' : 'Create in Spotify'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={previewLoading}
          onClick={() => setPreviewLoading((value) => !value)}
        >
          {previewLoading ? 'Stop loading preview' : 'Preview loading state'}
        </Button>
      </Row>

      <Row>
        <span className="type-meta w-8">link</span>
        <Link
          href="/"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Back to landing
        </Link>
        <span className="type-caption">
          A link with <code>buttonVariants()</code>: same classes, real anchor.
        </span>
      </Row>

      <Note>
        The loading state is only a preview here. In the product it is set while
        a real request is in flight, and the label changes to say what is
        happening.
      </Note>
    </Section>
  );
}

/* ------------------------------------------------------------------------- */
/* Fields                                                                     */
/* ------------------------------------------------------------------------- */

function FieldsSection() {
  const [name, setName] = React.useState('');
  const nameError =
    name.trim().length === 0 ? 'Give the playlist a name.' : undefined;

  return (
    <Section
      id="fields"
      title="Fields"
      lede="Surface-toned fields with a hairline border. Focus turns the border to the accent and adds a one pixel accent edge. Errors use the danger tone and are announced."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Field label="Playlist name" error={nameError} required>
          {(control) => (
            <Input
              {...control}
              value={name}
              placeholder="Late night Lagos"
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
        <Field
          label="Artist to start from"
          hint="MUSE searches Spotify for the exact artist."
        >
          {(control) => <Input {...control} placeholder="Tems" />}
        </Field>
        <Field label="Description" hint="Shown under the playlist in Spotify.">
          {(control) => (
            <Textarea
              {...control}
              placeholder="Smooth, late, a little nostalgic."
            />
          )}
        </Field>
        <Field label="Disabled" hint="Unavailable until Spotify is connected.">
          {(control) => <Input {...control} disabled placeholder="Not yet" />}
        </Field>
      </div>
      <Note>
        The first field validates as you type so the error state can be seen.
        Clear it to see the error, type to clear the error.
      </Note>
    </Section>
  );
}

/* ------------------------------------------------------------------------- */
/* Focus                                                                      */
/* ------------------------------------------------------------------------- */

function FocusSection() {
  return (
    <Section
      id="focus"
      title="Focus"
      lede="Keyboard focus is always visible. Controls get a two pixel accent ring with a two pixel gap. Fields get the accent edge. Press Tab from here to walk through them."
    >
      <Row>
        <a
          href="#focus"
          className="text-sm text-text-primary underline underline-offset-4"
        >
          Text link
        </a>
        <Button variant="secondary" size="sm">
          Button
        </Button>
        <Input
          aria-label="Field focus example"
          placeholder="Field"
          className="w-48"
        />
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" className="h-4 w-4" />
          Native checkbox
        </label>
      </Row>
      <Note>
        A control may refine its indicator (the chat composer softens its edge)
        but never removes it without supplying another. Pointer focus does not
        show the ring on buttons and links; it does on fields, where it doubles
        as the editing cue.
      </Note>
    </Section>
  );
}

/* ------------------------------------------------------------------------- */
/* Motion                                                                     */
/* ------------------------------------------------------------------------- */

const DEMO_ROWS = [
  'Reading your request',
  'Finding tracks',
  'Checking the catalogue',
  'I found a few things',
  'Something like Rema, but calmer',
  'Nigerian R&B, less mainstream',
];

function MotionSection() {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const [runKey, setRunKey] = React.useState(0);
  const [playing, setPlaying] = React.useState(true);

  return (
    <Section
      id="motion"
      title="Motion"
      lede="Transform and opacity only. One standard ease, one emphasized ease, one gentle spring. Staggers run 30ms to 50ms apart and never longer than 400ms in total."
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <dl className="space-y-2 text-sm">
          {(
            Object.keys(durationTokens) as Array<keyof typeof durationTokens>
          ).map((key) => (
            <div
              key={key}
              className="flex items-baseline justify-between gap-4 border-b border-border-subtle pb-2"
            >
              <dt>
                <code>--duration-{key}</code>
              </dt>
              <dd className="tabular-nums text-text-secondary">
                {durationTokens[key]}ms
              </dd>
            </div>
          ))}
        </dl>
        <dl className="space-y-2 text-sm">
          {(Object.keys(easingTokens) as Array<keyof typeof easingTokens>).map(
            (key) => (
              <div
                key={key}
                className="flex flex-col gap-1 border-b border-border-subtle pb-2"
              >
                <dt>
                  <code>--ease-{key}</code>
                </dt>
                <dd className="text-text-secondary">{easingTokens[key]}</dd>
              </div>
            ),
          )}
          <div className="flex flex-col gap-1 border-b border-border-subtle pb-2">
            <dt>
              <code>spring</code>
            </dt>
            <dd className="text-text-secondary">
              stiffness 260, damping 30, mass 1
            </dd>
          </div>
        </dl>
      </div>

      <div className="space-y-4">
        <Row>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRunKey((key) => key + 1)}
          >
            Replay reveal
          </Button>
          <span className="type-caption">
            {shouldReduceMotion
              ? 'Reduced motion is on: rows fade without moving.'
              : 'Rows rise 8px with a 40ms stagger.'}
          </span>
        </Row>
        <ul
          key={runKey}
          className="divide-y divide-border-subtle"
          aria-label="Staggered reveal example"
        >
          {DEMO_ROWS.map((row, index) => (
            <motion.li
              key={row}
              initial={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }
              }
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: staggerDelay(index, 0.04),
                duration: shouldReduceMotion ? durations.fast : durations.base,
                ease: easings.emphasized,
              }}
              className="flex items-center justify-between py-3 text-sm"
            >
              <span>{row}</span>
              <span className="type-meta tabular-nums">
                +{Math.round(staggerDelay(index, 0.04) * 1000)}ms
              </span>
            </motion.li>
          ))}
        </ul>
      </div>

      <Row>
        <EqualizerBars
          bars={5}
          height={16}
          playing={playing}
          label={playing ? 'Equalizer animating' : 'Equalizer paused'}
        />
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={!playing}
          onClick={() => setPlaying((value) => !value)}
        >
          {playing ? 'Pause equalizer' : 'Resume equalizer'}
        </Button>
        <span className="type-caption">
          Equalizers move only while something is loading or playing, and hold
          still when paused.
        </span>
      </Row>
    </Section>
  );
}

/* ------------------------------------------------------------------------- */
/* Layout                                                                     */
/* ------------------------------------------------------------------------- */

function useViewportWidth() {
  const [width, setWidth] = React.useState<number | null>(null);

  React.useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return width;
}

function shellLayoutFor(width: number): string {
  if (width >= breakpoints.lg) return 'Desktop: sidebar, main, Now Playing';
  if (width >= breakpoints.md) return 'Tablet: sidebar, main, bottom player';
  return 'Mobile: top bar, main, bottom player, bottom navigation';
}

function LayoutSection() {
  const width = useViewportWidth();

  return (
    <Section
      id="layout"
      title="Layout"
      lede="Three shell arrangements driven by Tailwind's breakpoints. Dimensions live as tokens so the shell, the chat composer, and sticky bars agree with each other."
    >
      <p className="text-sm text-text-secondary" aria-live="polite">
        {width === null
          ? 'Measuring the viewport.'
          : `This viewport is ${width}px wide. ${shellLayoutFor(width)}.`}
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <dl className="space-y-2 text-sm">
          {(Object.keys(breakpoints) as Array<keyof typeof breakpoints>).map(
            (key) => (
              <div
                key={key}
                className="flex items-baseline justify-between gap-4 border-b border-border-subtle pb-2"
              >
                <dt>
                  <code>{key}</code>
                </dt>
                <dd className="tabular-nums text-text-secondary">
                  {breakpoints[key]}px and up
                </dd>
              </div>
            ),
          )}
        </dl>
        <dl className="space-y-2 text-sm">
          {(
            [
              ['--muse-sidebar-width', layout.sidebarWidth],
              ['--muse-now-playing-width', layout.nowPlayingWidth],
              ['--muse-topbar-height', layout.topbarHeight],
              ['--muse-bottom-nav-height', layout.bottomNavHeight],
              ['--muse-header-height', layout.headerHeight],
            ] as const
          ).map(([name, value]) => (
            <div
              key={name}
              className="flex items-baseline justify-between gap-4 border-b border-border-subtle pb-2"
            >
              <dt>
                <code>{name}</code>
              </dt>
              <dd className="tabular-nums text-text-secondary">{value}px</dd>
            </div>
          ))}
        </dl>
      </div>

      <Note>
        Bottom bars add <code>var(--muse-safe-bottom)</code> so they clear the
        home indicator on phones; the viewport is set to <code>cover</code> for
        that reason. Mobile layouts are composed for the phone, not shrunk from
        desktop.
      </Note>
    </Section>
  );
}

/* ------------------------------------------------------------------------- */
/* Page                                                                       */
/* ------------------------------------------------------------------------- */

const NAV = [
  ['color', 'Color'],
  ['typography', 'Typography'],
  ['spacing', 'Spacing and shape'],
  ['buttons', 'Buttons'],
  ['fields', 'Fields'],
  ['focus', 'Focus'],
  ['motion', 'Motion'],
  ['layout', 'Layout'],
] as const;

export function DesignSystemReference() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-50 rounded-md bg-surface px-4 py-3 text-sm font-semibold text-text-primary focus:not-sr-only"
      >
        Skip to main content
      </a>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-page px-6 pb-24 pt-12 md:px-10 md:pt-20"
      >
        <header className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-12">
          <p className="type-section-label pt-2">Internal reference</p>
          <div>
            <h1 className="type-page-title">MUSE design system</h1>
            <p className="type-body mt-4 max-w-prose text-text-secondary">
              Tokens and primitives, rendered from the real components. This
              page is served in development only and is not part of the product.
            </p>
            <nav aria-label="Sections" className="mt-6">
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                {NAV.map(([id, label]) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className="text-text-secondary underline-offset-4 transition-colors hover:text-text-primary hover:underline"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>

        <div className="mt-12">
          <ColorSection />
          <TypographySection />
          <SpacingSection />
          <ButtonsSection />
          <FieldsSection />
          <FocusSection />
          <MotionSection />
          <LayoutSection />
        </div>
      </main>
    </div>
  );
}
