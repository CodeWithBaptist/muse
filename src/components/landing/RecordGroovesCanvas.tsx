'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { getEffectsLevel, subscribeUiPrefs } from '@/lib/ui-prefs-store';
import { beatEnvelope, subscribeBeat } from '@/lib/beat-clock';
import { HERO_DOT_PULSE_SCALE, HERO_DOT_SETTLE_MS } from '@/lib/hero-entrance';
import {
  HOVER_ENERGY_REST,
  HOVER_ENERGY_TARGET,
  LANDING_FALLBACK_PALETTE,
  drawHeroGrooves,
  easeEnergy,
  readLandingPalette,
  staticHeroFrame,
  visibleCenter,
  type HeroFrame,
  type LandingPalette,
  type Rect,
} from '@/lib/landing-canvas';

export const RECORD_GROOVES_TESTID = 'record-grooves-canvas';

/** The hero action attribute the hover energy listens for. */
export const HERO_ACTION_ATTRIBUTE = 'data-muse-hero-action';

const DPR_CAP = 2;
/** How long a cached hero rectangle stays good, so the loop never forces layout. */
const RECT_REFRESH_MS = 120;

export interface RecordGroovesCanvasProps {
  /** The hero content block: lime that crosses it is dimmed. */
  contentRef?: React.RefObject<HTMLElement | null>;
  /** The wordmark dot, scaled on the shared beat once the entrance settles. */
  pulseRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * The hero record.
 *
 * One canvas sits behind the hero content. It sizes itself from its own element
 * with a ResizeObserver, measures the content block with a second one, and draws
 * from the single shared beat loop, so there is never a second animation frame
 * loop in the page. It draws only while it is visible, and the shared loop does
 * nothing while the tab is hidden. Every listener goes through one
 * AbortController, so cleanup removes the loop, the observers, and the hover
 * listeners in a single pass.
 *
 * Under reduced motion it paints one static frame and never subscribes: no beat,
 * no wave, no needle sweep, no dot pulse.
 */
export function RecordGroovesCanvas({
  contentRef,
  pulseRef,
  className,
}: RecordGroovesCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const ctx =
      context as unknown as import('@/lib/landing-canvas').GrooveCanvasContext;
    const host = canvas.parentElement ?? canvas;
    const preference =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    // Reduced motion, Lite mode (chosen or automatic), or a hidden tab all mean still.
    const prefersReduced = () =>
      (preference?.matches ?? false) || getEffectsLevel() !== 'full';

    const controller = new AbortController();
    const { signal } = controller;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let cy = 0;
    let palette: LandingPalette = LANDING_FALLBACK_PALETTE;
    let contentRect: Rect = { left: 0, top: 0, width: 0, height: 0 };
    let energy = HOVER_ENERGY_REST;
    let hovered = false;
    let focused = false;
    let pressed = false;
    let visible = true;
    let rectReadAt = 0;
    let cachedBox = { left: 0, top: 0, width: 0, height: 0 };
    let unsubscribe: (() => void) | null = null;
    let startedAt = 0;

    const readBox = (force = false) => {
      const now = performance.now();
      if (force || now - rectReadAt > RECT_REFRESH_MS) {
        const box = canvas.getBoundingClientRect();
        cachedBox = {
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
        };
        rectReadAt = now;
      }
      return cachedBox;
    };

    const readContentRect = (): Rect => {
      const content = contentRef?.current;
      if (!content) return { left: 0, top: 0, width: 0, height: 0 };
      const rect = content.getBoundingClientRect();
      const box = readBox();
      return {
        left: rect.left - box.left,
        top: rect.top - box.top,
        width: rect.width,
        height: rect.height,
      };
    };

    const measure = () => {
      const box = readBox(true);
      width = Math.max(0, Math.round(box.width));
      height = Math.max(0, Math.round(box.height));
      dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);

      const backingWidth = Math.max(1, Math.round(width * dpr));
      const backingHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== backingWidth) canvas.width = backingWidth;
      if (canvas.height !== backingHeight) canvas.height = backingHeight;

      palette = readLandingPalette(getComputedStyle(canvas));
      contentRect = readContentRect();
      cy = visibleCenter(height, cachedBox.top, window.innerHeight);
    };

    const buildFrame = (timeMs: number, isStatic: boolean): HeroFrame => {
      if (isStatic) return staticHeroFrame(width, height, contentRect);
      return {
        width,
        height,
        cx: width / 2,
        cy,
        contentRect,
        timeMs,
        multiplier: energy,
        static: false,
      };
    };

    const paint = (timeMs: number, isStatic: boolean) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawHeroGrooves(ctx, buildFrame(timeMs, isStatic), palette);
    };

    /** The dot pulse is the only transform the loop writes outside the canvas. */
    const paintDot = (timeMs: number) => {
      const dot = pulseRef?.current;
      if (!dot) return;
      if (timeMs < HERO_DOT_SETTLE_MS) {
        dot.style.transform = '';
        return;
      }
      const scale = 1 + HERO_DOT_PULSE_SCALE * beatEnvelope(timeMs);
      dot.style.transform = `scale(${scale.toFixed(4)})`;
    };

    const paintStatic = () => {
      measure();
      energy = HOVER_ENERGY_REST;
      paint(0, true);
      const dot = pulseRef?.current;
      if (dot) dot.style.transform = '';
    };

    const tick = (nowMs: number) => {
      if (!visible) return;
      energy = easeEnergy(
        energy,
        hovered || focused || pressed ? HOVER_ENERGY_TARGET : HOVER_ENERGY_REST,
      );
      const timeMs = nowMs - startedAt;
      readBox();
      cy = visibleCenter(height, cachedBox.top, window.innerHeight);
      paint(timeMs, false);
      paintDot(timeMs);
    };

    const isAction = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      return target.closest(`[${HERO_ACTION_ATTRIBUTE}]`) !== null;
    };

    const onPointerOver = (event: PointerEvent) => {
      if (isAction(event.target)) hovered = true;
    };

    const onPointerOut = (event: PointerEvent) => {
      if (isAction(event.target)) hovered = false;
    };

    const onFocusIn = (event: FocusEvent) => {
      if (isAction(event.target)) focused = true;
    };

    const onFocusOut = (event: FocusEvent) => {
      if (isAction(event.target)) focused = false;
    };

    // Touch has no hover, so a press carries the energy instead, and releasing
    // the touch lets it fall back.
    const onTouchStart = (event: TouchEvent) => {
      if (isAction(event.target)) pressed = true;
    };

    const onTouchEnd = () => {
      pressed = false;
    };

    const onReducedMotionChange = () => {
      if (prefersReduced()) {
        unsubscribe?.();
        unsubscribe = null;
        paintStatic();
        return;
      }
      if (unsubscribe) return;
      startedAt = performance.now();
      measure();
      unsubscribe = subscribeBeat(tick);
    };

    const resizeObserver =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            if (prefersReduced()) paintStatic();
            else measure();
          })
        : null;
    resizeObserver?.observe(canvas);
    if (contentRef?.current) resizeObserver?.observe(contentRef.current);

    const intersectionObserver =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            visible = entry.isIntersecting;
            if (visible && !prefersReduced()) measure();
          })
        : null;
    intersectionObserver?.observe(canvas);

    host.addEventListener('pointerover', onPointerOver, {
      passive: true,
      signal,
    });
    host.addEventListener('pointerout', onPointerOut, {
      passive: true,
      signal,
    });
    host.addEventListener('focusin', onFocusIn, { signal });
    host.addEventListener('focusout', onFocusOut, { signal });
    host.addEventListener('touchstart', onTouchStart, {
      passive: true,
      signal,
    });
    host.addEventListener('touchend', onTouchEnd, { passive: true, signal });
    host.addEventListener('touchcancel', onTouchEnd, { passive: true, signal });
    preference?.addEventListener('change', onReducedMotionChange, { signal });
    // A theme or Lite change re-reads the tokens and starts or stops the beat.
    const unsubscribePrefs = subscribeUiPrefs(() => {
      measure();
      onReducedMotionChange();
    });

    startedAt = performance.now();
    measure();

    if (prefersReduced()) {
      paintStatic();
    } else {
      paint(0, false);
      unsubscribe = subscribeBeat(tick);
    }

    return () => {
      unsubscribePrefs();
      unsubscribe?.();
      unsubscribe = null;
      controller.abort();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
    };
  }, [contentRef, pulseRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid={RECORD_GROOVES_TESTID}
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full',
        className,
      )}
    />
  );
}
