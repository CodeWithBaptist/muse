'use client';

import * as React from 'react';
import { Surface } from '@/components/ui/Surface';
import { Logo } from '@/components/ui/Logo';
import { EqualizerBars } from '@/components/motion/EqualizerBars';
import { TrackRow } from '@/components/chat/TrackRow';
import { CreateInSpotifyButton } from '@/components/playlist/CreateInSpotifyButton';
import { LANDING_SAMPLE } from '@/lib/landing-sample';
import {
  PREVIEW_VISIBLE_THRESHOLD,
  previewCreateState,
  previewFinalState,
  previewStateAt,
  previewTimeline,
  type PreviewState,
} from '@/lib/landing-preview';

/** How often the scripted timeline is sampled while it plays. */
const PREVIEW_TICK_MS = 40;

/** Fixed, because the sample data is fixed: no state is derived per render. */
const TIMELINE = previewTimeline(LANDING_SAMPLE);
const REPLY_WORDS = LANDING_SAMPLE.reply.split(/\s+/).filter(Boolean);

/**
 * The scripted landing demo: the only simulated sequence in the product.
 *
 * It plays once when it is at least 40 percent visible, drives the real chat
 * components with sample data, pauses when it is offscreen or the tab is
 * hidden, and never loops on its own. Rows are mounted when the scripted
 * moment arrives, so the real TrackRow reveal does the 8px rise with its own
 * 50ms stagger. The server renders the finished frame, so the preview is
 * complete without JavaScript, and reduced motion keeps that frame with no
 * animation at all.
 *
 * Everything inside the conversation is inert and hidden from assistive
 * technology: no control here can be clicked, focused, or announced.
 */
export function ProductPreview() {
  const frameRef = React.useRef<HTMLDivElement | null>(null);
  const elapsedRef = React.useRef(0);
  const startedAtRef = React.useRef(0);
  const timerRef = React.useRef<number | null>(null);
  const playingRef = React.useRef(false);

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
    startTimer();
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
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          if (entry.isIntersecting) {
            if (!playingRef.current && elapsedRef.current === 0) {
              restart();
            } else {
              resume();
            }
          } else {
            pause();
          }
          observer?.disconnect();
        },
        { threshold: PREVIEW_VISIBLE_THRESHOLD },
      );
      observer.observe(node);
    } else {
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
      observer?.disconnect();
      controller.abort();
    };
  }, [restart, startTimer, stopTimer]);

  const phase = state.phase;
  const showPrompt = phase !== 'idle';
  const thinking = phase === 'thinking';
  const showReply = [
    'replying',
    'rows',
    'creating',
    'created',
    'open',
  ].includes(phase);
  const showRows = state.visibleTracks > 0;
  const showAction = showReply;

  return (
    <section
      aria-labelledby="product-preview-heading"
      className="mx-auto max-w-5xl px-6 py-20"
    >
      <h2 id="product-preview-heading" className="sr-only">
        Example MUSE conversation
      </h2>

      <p className="sr-only">
        An animated sample conversation. A listener asks for something like
        Brent Faiyaz but less sad. MUSE thinks for a moment, replies with a
        short recommendation, and shows three example tracks with an example
        Create in Spotify control. Nothing here contacts Spotify or OpenAI, no
        playlist is created, and every control in the sample is inert.
      </p>

      <Surface
        variant="flat"
        className="overflow-hidden border border-border-strong"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-surface p-4">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-medium uppercase tracking-widest text-text-muted">
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

        <div
          ref={frameRef}
          className="p-4 sm:p-6"
          data-preview-phase={phase}
        >
          <div
            inert
            aria-hidden="true"
            className="flex flex-col gap-4 select-none"
          >
            <div className="min-h-[104px] sm:min-h-[84px]">
              {showPrompt ? (
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
                  <EqualizerBars height={14} width={2} bars={4} />
                  <span className="text-xs font-semibold text-text-secondary">
                    {LANDING_SAMPLE.thinkingLines[state.thinkingLineIndex] ??
                      LANDING_SAMPLE.thinkingLines[0]}
                  </span>
                </>
              ) : null}
            </div>

            <div className="min-h-[128px] sm:min-h-[108px]">
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
                        className="transition-opacity duration-200"
                        style={{
                          opacity: index < state.replyWords ? 1 : 0,
                        }}
                      >
                        {index < REPLY_WORDS.length - 1 ? `${word} ` : word}
                      </span>
                    ))}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="min-h-[326px] sm:min-h-[330px]">
              {showRows ? (
                <div className="rounded-lg border border-accent/20 bg-accent/[0.02] p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="type-section-label">
                      {LANDING_SAMPLE.tracks.length} Tracks
                    </span>
                    <span className="truncate text-xs font-semibold text-text-primary">
                      {LANDING_SAMPLE.playlistName}
                    </span>
                  </div>

                  <div
                    role="list"
                    aria-label="Sample recommended tracks"
                    className="space-y-1"
                  >
                    {LANDING_SAMPLE.tracks.map((track, index) => (
                      <TrackRow
                        key={track.id}
                        track={{
                          id: track.id,
                          name: track.name,
                          artists: track.artist,
                          duration_ms: track.durationMs,
                        }}
                        index={index}
                        listItem
                      />
                    ))}
                  </div>

                  <div className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <CreateInSpotifyButton
                      name={LANDING_SAMPLE.playlistName}
                      trackUris={[]}
                      state={previewCreateState(LANDING_SAMPLE, state)}
                      inert
                      size="sm"
                    />
                    <span className="text-xs text-text-muted">
                      No playlist is created from this sample.
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="sr-only" data-preview-status>
              {state.done ? 'Sample sequence finished.' : 'Sample sequence.'}
            </div>
          </div>
        </div>
      </Surface>

      <p className="mt-3 text-xs text-text-muted">
        Sample conversation. Nothing here contacts Spotify or OpenAI and no
        playlist is created.
      </p>
    </section>
  );
}
