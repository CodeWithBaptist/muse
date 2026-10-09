'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { getEffectsLevel, subscribeUiPrefs } from '@/lib/ui-prefs-store';
import { subscribeBeat } from '@/lib/beat-clock';
import {
  BAND_HEIGHT,
  HOVER_ENERGY_REST,
  logoScale,
  HOVER_ENERGY_TARGET,
  LANDING_FALLBACK_PALETTE,
  drawLivingLogo,
  easeEnergy,
  readLandingPalette,
  staticBandFrame,
  type BandFrame,
  type GrooveCanvasContext,
  type LandingPalette,
  type LogoPath,
} from '@/lib/landing-canvas';
import {
  LANDING_WORDMARK_PIECES,
  LANDING_WORDMARK_WIDTH,
} from '@/lib/landing-wordmark';

export const CLOSING_BAND_TESTID = 'closing-band-canvas';

/** The closing action attribute the hover energy listens for. */
export const CLOSING_ACTION_ATTRIBUTE = 'data-muse-closing-action';

const DPR_CAP = 2;

export interface ClosingBandCanvasProps {
  className?: string;
}

/**
 * The living logo.
 *
 * A 240px band anchored to the bottom of the closing section, behind the text.
 * The wordmark is rebuilt from the same path data the hero uses, filled with
 * vertical bars, and swept by a playhead that loops every 7.7 seconds. It draws
 * from the single shared beat loop, only while it is visible, and it stops with
 * the tab.
 *
 * Under reduced motion it paints one static frame, with fixed bar heights and
 * the playhead parked at 40 percent, and never subscribes to the loop.
 */
export function ClosingBandCanvas({ className }: ClosingBandCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const ctx = context as unknown as GrooveCanvasContext;
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
    let palette: LandingPalette = LANDING_FALLBACK_PALETTE;
    let energy = HOVER_ENERGY_REST;
    let hovered = false;
    let focused = false;
    let pressed = false;
    let visible = true;
    let cursorX: number | null = null;
    let unsubscribe: (() => void) | null = null;
    let startedAt = 0;

    /** The Path2D objects are built once and reused for every frame. */
    let paths: LogoPath[] = [];
    const buildPaths = () => {
      if (typeof Path2D !== 'function') return [];
      return LANDING_WORDMARK_PIECES.map((piece) => ({
        piece,
        path: new Path2D(piece.d),
      }));
    };

    const measure = () => {
      const box = canvas.getBoundingClientRect();
      width = Math.max(0, Math.round(box.width));
      height = Math.max(0, Math.round(box.height));
      dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);

      const backingWidth = Math.max(1, Math.round(width * dpr));
      const backingHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== backingWidth) canvas.width = backingWidth;
      if (canvas.height !== backingHeight) canvas.height = backingHeight;

      palette = readLandingPalette(getComputedStyle(canvas));
    };

    const paint = (timeMs: number, isStatic: boolean) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const frame: BandFrame = isStatic
        ? staticBandFrame(width, height)
        : { width, height, timeMs, energy, cursorX, static: false };
      drawLivingLogo(ctx, frame, paths, palette);
    };

    const isAction = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      return target.closest(`[${CLOSING_ACTION_ATTRIBUTE}]`) !== null;
    };

    const onPointerMove = (event: PointerEvent) => {
      // Touch has no pointer, so the bars it passes never rise.
      if (event.pointerType === 'touch') {
        cursorX = null;
        return;
      }
      const box = canvas.getBoundingClientRect();
      const scale = logoScale(box.width, box.height);
      if (scale <= 0) {
        cursorX = null;
        return;
      }
      const x = event.clientX - box.left;
      if (x < 0 || x > box.width) {
        cursorX = null;
        return;
      }
      // Screen pixels back into logo units, the same scale the bars are drawn
      // at, with the logo centred on the band.
      cursorX = (x - box.width / 2) / scale + LANDING_WORDMARK_WIDTH / 2;
    };

    const onPointerLeave = () => {
      cursorX = null;
      hovered = false;
      pressed = false;
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

    const onTouchStart = (event: TouchEvent) => {
      if (isAction(event.target)) pressed = true;
    };

    const onTouchEnd = () => {
      pressed = false;
    };

    const tick = (nowMs: number) => {
      if (!visible) return;
      energy = easeEnergy(
        energy,
        hovered || focused || pressed ? HOVER_ENERGY_TARGET : HOVER_ENERGY_REST,
      );
      paint(nowMs - startedAt, false);
    };

    const onReducedMotionChange = () => {
      if (prefersReduced()) {
        unsubscribe?.();
        unsubscribe = null;
        paint(0, true);
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
            measure();
            if (prefersReduced()) paint(0, true);
          })
        : null;
    resizeObserver?.observe(canvas);

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

    canvas.addEventListener('pointermove', onPointerMove, {
      passive: true,
      signal,
    });
    canvas.addEventListener('pointerleave', onPointerLeave, { signal });
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

    paths = buildPaths();
    startedAt = performance.now();
    measure();

    if (prefersReduced()) {
      paint(0, true);
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
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid={CLOSING_BAND_TESTID}
      style={{ height: BAND_HEIGHT }}
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 w-full',
        className,
      )}
    />
  );
}
