'use client';

import * as React from 'react';
import { Surface } from '@/components/ui/Surface';
import { Logo } from '@/components/ui/Logo';
import { EqualizerBars } from '@/components/motion/EqualizerBars';
import { TrackRow } from '@/components/chat/TrackRow';
import { SampleListActions } from './SampleListActions';
import { LANDING_SAMPLE } from '@/lib/landing-sample';
import {
  PREVIEW_VISIBLE_THRESHOLD,
  previewFinalState,
  previewStateAt,
  previewTimeline,
  type PreviewState,
} from '@/lib/landing-preview';

/** How often the scripted timeline is sampled while it plays. */
const PREVIEW_TICK_MS = 40;
/** How long one word of the reply takes to fade in. */
const PREVIEW_REPLY_FADE_MS = 400;

/** Fixed, because the sample data is fixed: no state is derived per render. */
const TIMELINE = previewTimeline(LANDING_SAMPLE);
const REPLY_WORDS = LANDING_SAMPLE.reply.split(/\s+/).filter(Boolean);
const TRACK_COUNT_LABEL = `${LANDING_SAMPLE.tracks.length} tracks`;

/**
 * The scripted landing demo: the only simulated sequence in the product.
 *
 * It plays once, when the window is at least 40 percent visible, and drives the
 * real chat components with sample data. Before it starts the window is not
 * empty: the hint and the placeholder are already there. It pauses when it is
 * offscreen or the tab is hidden, never loops on its own, and the server
 * renders the finished frame so the preview is complete without JavaScript.
 * Reduced motion keeps that frame with no animation at all.
 *
 * Everything inside the window is inert: no control here can be clicked,
 * focused, or announced, and the reply text stays selectable.
 */
export function ProductPreview() {
  const frameRef = React.useRef<HTMLDivElement | null>(null);
  const elapsedRef = React.useRef(0);
  const startedAtRef = React.useRef(0);
  const timerRef = React.useRef<number | null>(null);
  const playingRef = React.useRef(false);
  /** True while the window is at least 40 percent visible. */
  const visibleRef = React.useRef(false);
  /** True once the window has been seen, so the idle frame replaced the final one. */
  const armedRef = React.useRef(false);

  const [state, setState] = React.useState<PreviewState>(() =>
    previewFinalState(LANDING_SAMPLE),
  );

  const stopTimer = React.useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = React.useCallback(() => {
    if (timerRef.current !== null) return;
    startedAtRef.current = performance.now() - elapsedRef.current;
    timerRef.current = window.setInterval(() => {
      const elapsed = performance.now() - startedAtRef.current;
      elapsedRef.current = elapsed;
      const next = previewStateAt(LANDING_SAMPLE, elapsed);
      setState(next);
      if (next.done) {
        playingRef.current = false;
        stopTimer();
      }
    }, PREVIEW_TICK_MS);
  }, [stopTimer]);

  const restart = React.useCallback(() => {
    // Reduced motion never animates: replaying simply shows the finished frame.
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      elapsedRef.current = TIMELINE.totalMs;
      playingRef.current = false;
      stopTimer();
      setState(previewFinalState(LANDING_SAMPLE));
      return;
    }
    elapsedRef.current = 0;
    // The prompt starts typing on the next frame, so the first frame of the
    // replay is already the typing phase instead of an empty slate.
    setState(previewStateAt(LANDING_SAMPLE, 0));
    playingRef.current = true;
    // Replaying while offscreen waits for the preview to come back.
    if (visibleRef.current) startTimer();
  }, [startTimer, stopTimer]);

  React.useEffect(() => {
    const node = frameRef.current;
    if (!node) return;

    const preference =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    const prefersReduced = () => preference?.matches ?? false;

    // Reduced motion: keep the finished frame the server rendered. No timer.
    if (prefersReduced()) return;

    const controller = new AbortController();
    const { signal } = controller;

    const pause = () => {
      if (!playingRef.current) return;
      elapsedRef.current = performance.now() - startedAtRef.current;
      stopTimer();
    };

    const resume = () => {
      if (!playingRef.current) return;
      if (elapsedRef.current >= TIMELINE.totalMs) return;
      if (document.hidden) return;
      startTimer();
    };

    let fallbackTimer = 0;
    let armObserver: IntersectionObserver | null = null;
    let observer: IntersectionObserver | null = null;

    if (typeof IntersectionObserver === 'function') {
      // The window is armed as soon as any part of it is on screen, while it is
      // still mostly out of view, so the swap from the finished frame to the
      // idle frame happens where it cannot be seen.
      armObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry || !entry.isIntersecting || armedRef.current) return;
          armedRef.current = true;
          if (playingRef.current) return;
          elapsedRef.current = 0;
          setState(previewStateAt(LANDING_SAMPLE, 0));
        },
        { threshold: 0.01 },
      );
      armObserver.observe(node);

      // The observer keeps running, because the preview has to pause when it
      // leaves the viewport and pick up from where it stopped.
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          visibleRef.current = entry.isIntersecting;
          if (entry.isIntersecting) {
            if (!playingRef.current && elapsedRef.current === 0) {
              restart();
            } else {
              resume();
            }
          } else {
            pause();
          }
        },
        { threshold: PREVIEW_VISIBLE_THRESHOLD },
      );
      observer.observe(node);
    } else {
      visibleRef.current = true;
      // No observer (very old browser): play straight away.
      fallbackTimer = window.setTimeout(() => restart(), 0);
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        pause();
      } else {
        resume();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange, {
      signal,
    });

    const onPreferenceChange = () => {
      if (!prefersReduced()) return;
      playingRef.current = false;
      stopTimer();
      setState(previewFinalState(LANDING_SAMPLE));
    };
    preference?.addEventListener('change', onPreferenceChange, { signal });

    return () => {
      stopTimer();
      window.clearTimeout(fallbackTimer);
      armObserver?.disconnect();
      observer?.disconnect();
      controller.abort();
    };
  }, [restart, startTimer, stopTimer]);

  const phase = state.phase;
  const promptInInput = !state.promptInThread;
  const thinking = phase === 'thinking';
  const showReply =
    phase === 'replying' ||
    phase === 'rows' ||
    phase === 'copying' ||
    phase === 'copied' ||
    phase === 'open' ||
    phase === 'playing';
  const showRows = state.visibleTracks > 0;

  return (
    <section
      id="see-it-work"
      aria-labelledby="see-it-work-heading"
      className="mx-auto max-w-5xl scroll-mt-24 px-5 py-20 sm:px-6 sm:py-24"
    >
      <div className="mx-auto max-w-2xl space-y-4 text-center">
        <p className="type-section-label">See it work</p>
        <h2
          id="see-it-work-heading"
          className="type-display text-[clamp(28px,5vw,48px)] text-balance"
        >
          Say the vibe. Get the playlist.
        </h2>
      </div>

      <p className="sr-only">
        An animated sample conversation. A listener asks for something for a
        late night drive. MUSE thinks for a moment, replies with a short
        recommendation, shows three example tracks, and copies the list before
        the open-in links appear. Nothing here contacts OpenAI, a music
        catalogue, or any music service, nothing is copied or shared, and every
        control in the sample is inert.
      </p>

      <Surface
        variant="flat"
        className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-lg border border-border-strong"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-surface px-4 py-3">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-border-strong" />
            <span className="h-2 w-2 rounded-full bg-border-strong" />
            <span className="h-2 w-2 rounded-full bg-border-strong" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              Sample
            </span>
            <button
              type="button"
              onClick={restart}
              className="rounded-md px-2 py-1 text-xs font-semibold text-text-secondary transition-colors hover:bg-background hover:text-text-primary focus-ring"
            >
              Replay
            </button>
          </div>
        </div>

        <div ref={frameRef} className="p-4 sm:p-6" data-preview-phase={phase}>
          <div inert aria-hidden="true" className="flex flex-col gap-4">
            <div className="min-h-[76px] sm:min-h-[60px]">
              {state.promptInThread ? (
                <div className="ml-auto max-w-md">
                  <div className="rounded-2xl rounded-tr-none border border-accent/10 bg-accent/5 px-6 py-4 text-sm font-medium leading-relaxed">
                    {state.typedPrompt}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex min-h-[32px] items-center gap-3">
              {thinking ? (
                <>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border-subtle bg-surface">
                    <Logo variant="mark" size={20} />
                  </div>
                  <EqualizerBars height={14} width={2} bars={3} />
                  <span className="text-xs font-semibold text-text-secondary">
                    {LANDING_SAMPLE.thinkingLines[state.thinkingLineIndex] ??
                      LANDING_SAMPLE.thinkingLines[0]}
                  </span>
                </>
              ) : null}
            </div>

            <div className="min-h-[112px] sm:min-h-[92px]">
              {showReply ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border-subtle bg-surface">
                      <Logo variant="mark" size={20} />
                    </div>
                    <span className="text-xs font-semibold text-text-secondary">
                      Example response
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed text-text-secondary">
                    {REPLY_WORDS.map((word, index) => (
                      <span
                        key={`${index}-${word}`}
                        style={{
                          opacity: index < state.replyWords ? 1 : 0,
                          transitionProperty: 'opacity',
                          transitionDuration: `${PREVIEW_REPLY_FADE_MS}ms`,
                          transitionTimingFunction: 'var(--ease-emphasized)',
                        }}
                      >
                        {index < REPLY_WORDS.length - 1 ? `${word} ` : word}
                      </span>
                    ))}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="min-h-[330px] sm:min-h-[334px]">
              {showRows ? (
                <div className="rounded-lg border border-accent/20 bg-accent/[0.02] p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-text-primary">
                      {LANDING_SAMPLE.playlistName}
                    </span>
                    <span className="type-section-label tabular-nums">
                      {TRACK_COUNT_LABEL}
                    </span>
                  </div>

                  <div role="list" className="space-y-1">
                    {LANDING_SAMPLE.tracks.map((track, index) => (
                      <TrackRow
                        key={track.id}
                        track={{
                          id: track.id,
                          name: track.name,
                          artists: track.artist,
                          duration_ms: track.durationMs,
                          reason: track.reason,
                        }}
                        index={index}
                        listItem
                        canPlay={state.playing && index === 0}
                        isPlaying={state.playing && index === 0}
                      />
                    ))}
                  </div>

                  <div className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <SampleListActions status={state.actionStatus} />
                    <span className="text-xs text-text-muted">
                      Nothing is copied or shared from this sample.
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="sr-only" data-preview-status>
              {state.done ? 'Sample sequence finished.' : 'Sample sequence.'}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-text-muted">
                {LANDING_SAMPLE.hint}
              </p>
              <input
                type="text"
                readOnly
                tabIndex={-1}
                aria-hidden="true"
                data-testid="sample-input"
                value={promptInInput ? state.typedPrompt : ''}
                placeholder={LANDING_SAMPLE.inputPlaceholder}
                className="h-11 w-full rounded-md border border-border-strong bg-background px-4 text-sm font-medium text-text-primary placeholder:text-text-muted"
              />
            </div>
          </div>
        </div>
      </Surface>

      <p className="mx-auto mt-4 max-w-3xl text-xs text-text-muted">
        Sample conversation. Nothing here contacts OpenAI or any music service,
        and nothing is copied or shared.
      </p>
    </section>
  );
}
