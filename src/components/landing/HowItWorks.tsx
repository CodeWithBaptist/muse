'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { EqualizerBars } from '@/components/motion/EqualizerBars';
import { SampleListActions } from './SampleListActions';
import { prefersReducedMotion } from '@/lib/landing-scroll';
import { LANDING_SAMPLE, type SampleTrack } from '@/lib/landing-sample';
import {
  STEP_BAND_ROOT_MARGIN,
  activeStepIndex,
  markStepPlayed,
  railProgress,
  stepIsActive,
  stepNumberIsAccent,
  stepOpacity,
} from '@/lib/landing-steps';

/** How often a step visual samples its own script. */
const STEP_TICK_MS = 40;

/**
 * Runs a step's small visual once, from the moment its step becomes active.
 *
 * The clock advances only while the document is visible, and it stops when the
 * script finishes, so nothing keeps ticking. Reduced motion jumps straight to
 * the finished frame.
 */
function useStepClock(
  running: boolean,
  totalMs: number,
  final: boolean,
): number {
  const [elapsed, setElapsed] = React.useState(0);
  const elapsedRef = React.useRef(0);

  React.useEffect(() => {
    if (final) return;
    if (!running) return;
    if (elapsedRef.current >= totalMs) {
      setElapsed(totalMs);
      return;
    }

    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      if (!document.hidden) {
        elapsedRef.current = Math.min(totalMs, elapsedRef.current + delta);
      }
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= totalMs) window.clearInterval(id);
    }, STEP_TICK_MS);

    return () => window.clearInterval(id);
  }, [running, totalMs, final]);

  // With no JavaScript at all, or with motion turned off, no script ever runs.
  // The visual then holds its last frame rather than its first, so the section
  // still reads as finished.
  return final ? totalMs : elapsed;
}

/** What every step visual is told by its step. */
type VisualProps = { running: boolean; final: boolean };

/** The preference never changes mid render, so nothing needs to subscribe. */
const subscribeToPreference = () => () => {};

/** True when a browser with motion allowed can watch the steps at all. */
function scriptsWillRun(): boolean {
  if (typeof IntersectionObserver !== 'function') return false;
  return !prefersReducedMotion();
}

/* -------------------------------------------------------------------------- */
/* Step scripts                                                               */
/* -------------------------------------------------------------------------- */

/** How long the typing visual takes, per character, and how long it holds. */
export const STEP_TYPE_CHAR_MS = 45;
export const STEP_TYPE_HOLD_MS = 400;
export const STEP_TYPE_TEXT = 'late night Afrobeats but chill';
export const STEP_TYPE_TOTAL_MS =
  STEP_TYPE_TEXT.length * STEP_TYPE_CHAR_MS + STEP_TYPE_HOLD_MS;

/** The three beats of the understanding visual. */
export const STEP_THINK_LINE_MS = 900;
export const STEP_THINK_TOTAL_MS = STEP_THINK_LINE_MS * 2;
export const STEP_THINK_LINES = [
  'Reading your request',
  'Finding tracks',
  'I found a few things',
] as const;

/** Two rows rise in, then the reason line appears. */
export const STEP_ROW_STAGGER_MS = 50;
export const STEP_ROW_RISE_MS = 320;
export const STEP_WHY_AT_MS = 700;
export const STEP_WHY_TOTAL_MS = STEP_WHY_AT_MS + 400;
/** The reason line follows the first sample track, so the two never drift. */
export const STEP_WHY_TEXT = `Why this: ${LANDING_SAMPLE.tracks[0].reason
  .charAt(0)
  .toLowerCase()}${LANDING_SAMPLE.tracks[0].reason.slice(1)}`;

/** The list actions walk their four states. */
export const STEP_ACTION_AT_MS = 400;
export const STEP_ACTION_MS = 900;
export const STEP_ACTION_HOLD_MS = 1200;
export const STEP_ACTION_TOTAL_MS =
  STEP_ACTION_AT_MS + STEP_ACTION_MS + STEP_ACTION_HOLD_MS;

/** Which action state the step visual is showing. */
export function stepActionStatus(elapsed: number) {
  if (elapsed >= STEP_ACTION_TOTAL_MS) return 'open' as const;
  if (elapsed >= STEP_ACTION_AT_MS + STEP_ACTION_MS) return 'success' as const;
  if (elapsed >= STEP_ACTION_AT_MS) return 'loading' as const;
  return 'idle' as const;
}

/** Which line the understanding visual is showing. */
export function stepThinkLineIndex(elapsed: number): number {
  if (elapsed >= STEP_THINK_TOTAL_MS) return 2;
  return elapsed < STEP_THINK_LINE_MS ? 0 : 1;
}

export const LANDING_STEPS = [
  {
    title: 'Tell it the vibe',
    description: 'Type a mood, an artist, or a moment. Plain words are enough.',
  },
  {
    title: 'MUSE understands',
    description:
      'It reads your request, picks real songs, and checks each one against Deezer and iTunes.',
  },
  {
    title: 'See why',
    description: 'Each pick comes with a one-line reason.',
  },
  {
    title: 'Take it anywhere',
    description:
      'Copy or share the list, then open each song on Audiomack, Boomplay, Spotify, or Apple Music.',
  },
] as const;

/** Step 1: a plain input typing a request. */
function StepTypingVisual({ running, final }: VisualProps) {
  const elapsed = useStepClock(running, STEP_TYPE_TOTAL_MS, final);
  const shown = STEP_TYPE_TEXT.slice(
    0,
    Math.min(STEP_TYPE_TEXT.length, Math.floor(elapsed / STEP_TYPE_CHAR_MS)),
  );

  return (
    <div
      aria-hidden="true"
      data-testid="step-typing-visual"
      className="flex h-11 items-center rounded-md border border-border-strong bg-background px-4 text-sm font-medium text-text-primary"
    >
      {shown || <span className="text-text-muted">late night</span>}
    </div>
  );
}

/** Step 2: the thinking indicator, which freezes once it has an answer. */
function StepThinkingVisual({ running, final }: VisualProps) {
  const elapsed = useStepClock(running, STEP_THINK_TOTAL_MS, final);
  const found = elapsed >= STEP_THINK_TOTAL_MS;
  const lineIndex = stepThinkLineIndex(elapsed);

  return (
    <div
      aria-hidden="true"
      data-testid="step-thinking-visual"
      className="flex items-center gap-3"
    >
      <EqualizerBars height={14} width={2} bars={3} playing={!found} />
      <span className="text-xs font-semibold text-text-secondary">
        {STEP_THINK_LINES[lineIndex]}
      </span>
    </div>
  );
}

/** A compact presentational row for the small step visuals. */
function MiniTrackRow({
  track,
  index,
  rise,
}: {
  track: SampleTrack;
  index: number;
  rise: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 border-b border-border-subtle py-2 last:border-0 transition-[opacity,transform] duration-[320ms]',
        rise ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
      )}
      style={{ transitionDelay: `${index * STEP_ROW_STAGGER_MS}ms` }}
    >
      <span className="min-w-0 truncate text-sm font-semibold text-text-primary">
        {track.name}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-text-muted">
        {track.artist}
      </span>
    </div>
  );
}

/** Step 3: two rows rise in, then the reason line. */
function StepReasonVisual({ running, final }: VisualProps) {
  const elapsed = useStepClock(running, STEP_WHY_TOTAL_MS, final);
  const rows = LANDING_SAMPLE.tracks.slice(0, 2);

  return (
    <div
      aria-hidden="true"
      data-testid="step-reason-visual"
      className="space-y-1"
    >
      {rows.map((track, index) => (
        <MiniTrackRow
          key={track.id}
          track={track}
          index={index}
          rise={elapsed >= index * STEP_ROW_STAGGER_MS + STEP_ROW_RISE_MS}
        />
      ))}
      <p
        className="pt-2 text-xs leading-relaxed text-text-secondary transition-opacity duration-[400ms]"
        style={{ opacity: elapsed >= STEP_WHY_AT_MS ? 1 : 0 }}
      >
        {STEP_WHY_TEXT}
      </p>
    </div>
  );
}

/** Step 4: the list actions, walked through copy, copied, and the open-in links. */
function StepActionsVisual({ running, final }: VisualProps) {
  const elapsed = useStepClock(running, STEP_ACTION_TOTAL_MS, final);
  return <SampleListActions status={stepActionStatus(elapsed)} />;
}

const STEP_VISUALS = [
  StepTypingVisual,
  StepThinkingVisual,
  StepReasonVisual,
  StepActionsVisual,
] as const;

/* -------------------------------------------------------------------------- */
/* Section                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * How it works.
 *
 * A thin rail on the left fills as the steps become active, with a transform, so
 * nothing in the section changes layout. The step crossing the middle band of
 * the viewport is the active one: it reads at full strength and its number turns
 * lime, while the others dim. Each small visual plays once, the first time its
 * step becomes active, and then holds its final frame. There is no scroll
 * jacking: the page scrolls exactly as it would without this section.
 */
export function HowItWorks() {
  const stepRefs = React.useRef<Array<HTMLLIElement | null>>([]);
  const [crossing, setCrossing] = React.useState<number[]>([]);
  const [played, setPlayed] = React.useState<boolean[]>(() =>
    LANDING_STEPS.map(() => false),
  );
  const [visible, setVisible] = React.useState<boolean[]>(() =>
    LANDING_STEPS.map(() => false),
  );
  /**
   * Whether the step scripts will run at all. The server snapshot is false, so
   * the server render and a visitor with no JavaScript both see finished
   * visuals, and reduced motion never arms a script.
   */
  const scriptsRun = React.useSyncExternalStore(
    subscribeToPreference,
    scriptsWillRun,
    () => false,
  );

  const active = activeStepIndex(crossing);

  React.useEffect(() => {
    // Nothing to watch: reduced motion, or no IntersectionObserver. The visuals
    // already hold their last frame.
    if (!scriptsRun) return;

    const nodes = stepRefs.current.filter((node): node is HTMLLIElement =>
      Boolean(node),
    );
    if (nodes.length === 0) return;

    const indexOf = (target: Element) =>
      nodes.findIndex((node) => node === target);

    const bandObserver = new IntersectionObserver(
      (entries) => {
        const inside = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => indexOf(entry.target))
          .filter((index) => index >= 0);
        if (inside.length === 0) return;
        setCrossing(inside);

        // A step plays its visual once, the first time it becomes active.
        const nowActive = activeStepIndex(inside);
        if (nowActive < 0) return;
        setPlayed((previous) =>
          previous[nowActive] ? previous : markStepPlayed(previous, nowActive),
        );
      },
      { rootMargin: STEP_BAND_ROOT_MARGIN },
    );

    // A second observer keeps each visual paused while its step is offscreen.
    const viewObserver = new IntersectionObserver(
      (entries) => {
        setVisible((previous) => {
          const next = [...previous];
          let changed = false;
          for (const entry of entries) {
            const index = indexOf(entry.target);
            if (index < 0 || next[index] === entry.isIntersecting) continue;
            next[index] = entry.isIntersecting;
            changed = true;
          }
          return changed ? next : previous;
        });
      },
      { threshold: 0 },
    );

    nodes.forEach((node) => {
      bandObserver.observe(node);
      viewObserver.observe(node);
    });

    return () => {
      bandObserver.disconnect();
      viewObserver.disconnect();
    };
  }, [scriptsRun]);

  const progress = railProgress(active, LANDING_STEPS.length);

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="scroll-mt-24 border-t border-border-subtle px-5 py-20 sm:px-6 sm:py-24"
    >
      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl space-y-4">
          <p className="type-section-label">How it works</p>
          <h2
            id="how-it-works-heading"
            className="type-display text-[clamp(28px,5vw,48px)] text-balance"
          >
            Four steps. No filters.
          </h2>
        </div>

        <div className="relative mt-14 pl-8 sm:pl-10">
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-0 top-0 w-px bg-border-subtle"
          />
          <div
            aria-hidden="true"
            className="muse-rail-fill absolute bottom-0 left-0 top-0 w-px bg-accent"
            data-testid="how-it-works-rail"
            data-progress={progress.toFixed(3)}
            style={{ transform: `scaleY(${progress})` }}
          />

          <ol className="space-y-14 sm:space-y-16">
            {LANDING_STEPS.map((step, index) => {
              const Visual = STEP_VISUALS[index];
              const isActive = stepIsActive(active, index);
              return (
                <li
                  key={step.title}
                  ref={(node) => {
                    stepRefs.current[index] = node;
                  }}
                  data-step={index}
                  data-current={active === index ? 'true' : 'false'}
                  className="muse-step"
                  style={{ opacity: stepOpacity(active, index) }}
                >
                  <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)] md:gap-12">
                    <div className="space-y-3">
                      <span
                        className={cn(
                          'text-sm font-semibold tabular-nums',
                          stepNumberIsAccent(active, index)
                            ? 'text-accent'
                            : 'text-text-muted',
                        )}
                      >
                        0{index + 1}
                      </span>
                      <h3 className="text-lg font-semibold text-text-primary">
                        {step.title}
                      </h3>
                      <p className="type-body max-w-md text-text-secondary">
                        {step.description}
                      </p>
                    </div>
                    <div className="min-h-[88px] md:pt-7">
                      <Visual
                        running={played[index] && visible[index] && isActive}
                        final={!scriptsRun}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
