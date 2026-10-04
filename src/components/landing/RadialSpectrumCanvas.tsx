'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import { HERO_DOT_PULSE_SCALE, HERO_DOT_SETTLE_MS } from '@/lib/hero-entrance';
import {
  SPECTRUM_FALLBACK_PALETTE,
  SPECTRUM_HOVER_AMPLITUDE,
  SPECTRUM_INTRO_BUILD_MS,
  SPECTRUM_INTRO_START_MS,
  barCountForWidth,
  beatEnvelope,
  drawRadialSpectrum,
  easeAmplitude,
  nextBarCount,
  readSpectrumPalette,
  ringForRect,
  staticSpectrumFrame,
  type RadialFrame,
  type RadialPalette,
  type Rect,
  type SpectrumCanvasContext,
} from '@/lib/radial-spectrum';

export const RADIAL_SPECTRUM_TESTID = 'radial-spectrum-canvas';

/** The hero action attribute the hover amplitude listens for. */
export const HERO_ACTION_ATTRIBUTE = 'data-muse-hero-action';

const DPR_CAP = 2;
const FRAME_WINDOW = 30;
const RECT_REFRESH_MS = 120;

export interface RadialSpectrumCanvasProps {
  /** The hero content block: the ring is drawn around its rectangle. */
  contentRef?: RefObject<HTMLElement | null>;
  /** The wordmark dot: scaled on the shared beat once the dot has settled. */
  pulseRef?: RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * The hero radial spectrum.
 *
 * One canvas sits behind the hero content. It measures the hero and the content
 * block with ResizeObservers, draws in one requestAnimationFrame loop that can
 * never start twice, and pauses when the hero is offscreen or the tab is
 * hidden. Every listener is registered with an AbortController, so cleanup
 * removes the loop, the observers, and the listeners in one pass.
 *
 * Under reduced motion it paints a single static frame and never starts the
 * loop: no rotation, no beat, no pointer pull, no intro build.
 */
export function RadialSpectrumCanvas({
  contentRef,
  pulseRef,
  className,
}: RadialSpectrumCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const ctx = context as unknown as SpectrumCanvasContext;
    const host = canvas.parentElement ?? canvas;
    const preference =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    const prefersReduced = () => preference?.matches ?? false;

    const controller = new AbortController();
    const { signal } = controller;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let barCount = barCountForWidth(0);
    let palette: RadialPalette = SPECTRUM_FALLBACK_PALETTE;
    let contentRect: Rect = { left: 0, top: 0, width: 0, height: 0 };
    let amplitude = 1;
    /** Independent hover, press, and focus state on the hero actions. */
    let hoverAction = false;
    let pressAction = false;
    let focusAction = false;
    let pointerAngle: number | null = null;
    let visible = true;
    let frameHandle = 0;
    let closed = false;
    let startedAt = 0;
    let lastFrameTime = 0;
    let frameDurations: number[] = [];
    let rectReadAt = 0;
    let cachedRect = { left: 0, top: 0, width: 0, height: 0 };

    /** Canvas box, cached so pointer moves do not force layout every event. */
    const readRect = (force = false) => {
      const now = performance.now();
      if (force || now - rectReadAt > RECT_REFRESH_MS) {
        const box = canvas.getBoundingClientRect();
        cachedRect = {
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
        };
        rectReadAt = now;
      }
      return cachedRect;
    };

    const readContentRect = (box: typeof cachedRect): Rect => {
      const content = contentRef?.current;
      if (!content) return { left: 0, top: 0, width: 0, height: 0 };
      const rect = content.getBoundingClientRect();
      return {
        left: rect.left - box.left,
        top: rect.top - box.top,
        width: rect.width,
        height: rect.height,
      };
    };

    const measure = () => {
      const box = readRect(true);
      width = Math.max(0, Math.round(box.width));
      height = Math.max(0, Math.round(box.height));
      dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);

      const backingWidth = Math.max(1, Math.round(width * dpr));
      const backingHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== backingWidth) canvas.width = backingWidth;
      if (canvas.height !== backingHeight) canvas.height = backingHeight;

      barCount = barCountForWidth(width);
      palette = readSpectrumPalette(getComputedStyle(canvas));
      contentRect = readContentRect(box);
    };

    const buildFrame = (timeMs: number, isStatic: boolean): RadialFrame => {
      const ring = ringForRect(contentRect, width, height);
      if (isStatic) {
        return staticSpectrumFrame(width, height, ring, contentRect, barCount);
      }
      return {
        width,
        height,
        ring,
        contentRect,
        timeMs,
        amplitude,
        barCount,
        pointerAngle,
        static: false,
      };
    };

    const paint = (timeMs: number, isStatic: boolean) => {
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRadialSpectrum(ctx, buildFrame(timeMs, isStatic), palette);
    };

    /** The pulse is the only transform the loop writes outside the canvas. */
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
      amplitude = 1;
      pointerAngle = null;
      hoverAction = false;
      pressAction = false;
      paint(0, true);
      const dot = pulseRef?.current;
      if (dot) dot.style.transform = '';
    };

    const tick = (now: number) => {
      if (closed) return;
      frameHandle = window.requestAnimationFrame(tick);

      if (document.hidden || !visible) {
        lastFrameTime = 0;
        return;
      }

      if (lastFrameTime > 0) {
        frameDurations.push(now - lastFrameTime);
        if (frameDurations.length >= FRAME_WINDOW) {
          const average =
            frameDurations.reduce((total, value) => total + value, 0) /
            frameDurations.length;
          frameDurations = [];
          const next = nextBarCount(
            barCount,
            average,
            barCountForWidth(width),
          );
          if (next !== barCount) barCount = next;
        }
      }

      lastFrameTime = now;
      amplitude = easeAmplitude(amplitude, actionAmplitude());
      const timeMs = now - startedAt;
      paint(timeMs, false);
      paintDot(timeMs);
    };

    const start = () => {
      if (closed || frameHandle !== 0) return;
      lastFrameTime = 0;
      frameDurations = [];
      frameHandle = window.requestAnimationFrame(tick);
    };

    const stop = () => {
      if (frameHandle !== 0) {
        window.cancelAnimationFrame(frameHandle);
        frameHandle = 0;
      }
    };

    const isAction = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      return target.closest(`[${HERO_ACTION_ATTRIBUTE}]`) !== null;
    };

    const actionAmplitude = () =>
      hoverAction || pressAction || focusAction ? SPECTRUM_HOVER_AMPLITUDE : 1;

    const onPointerMove = (event: PointerEvent) => {
      // Touch has no hover state and no pointer pull.
      if (event.pointerType === 'touch') return;

      hoverAction = isAction(event.target);

      const box = readRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      if (x < 0 || y < 0 || x > box.width || y > box.height) {
        pointerAngle = null;
        return;
      }

      const ring = ringForRect(contentRect, width, height);
      pointerAngle = Math.atan2(y - ring.cy, x - ring.cx);
    };

    const onPointerLeave = () => {
      pointerAngle = null;
      hoverAction = false;
      pressAction = false;
    };

    const onPointerDown = (event: PointerEvent) => {
      // Also the touch path: a press on an action lifts the ring.
      if (isAction(event.target)) pressAction = true;
    };

    const onPointerUp = () => {
      pressAction = false;
    };

    const onFocusIn = (event: FocusEvent) => {
      if (isAction(event.target)) focusAction = true;
    };

    const onFocusOut = (event: FocusEvent) => {
      if (isAction(event.target)) focusAction = false;
    };

    const onPointerCancel = () => {
      hoverAction = false;
      pressAction = false;
      pointerAngle = null;
    };

    const onVisibilityChange = () => {
      lastFrameTime = 0;
    };

    const onReducedMotionChange = () => {
      if (prefersReduced()) {
        stop();
        paintStatic();
      } else {
        // Coming back from reduced motion: keep the ring settled instead of
        // replaying the intro build.
        startedAt =
          performance.now() -
          (SPECTRUM_INTRO_START_MS + SPECTRUM_INTRO_BUILD_MS);
        measure();
        start();
      }
    };

    const resizeObserver =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            if (prefersReduced()) {
              paintStatic();
            } else {
              measure();
            }
          })
        : null;
    resizeObserver?.observe(host);

    const intersectionObserver =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            visible = entry.isIntersecting;
            lastFrameTime = 0;
            if (visible && !prefersReduced()) {
              measure();
              start();
            }
          })
        : null;
    intersectionObserver?.observe(host);

    host.addEventListener('pointermove', onPointerMove, { passive: true, signal });
    host.addEventListener('pointerleave', onPointerLeave, { signal });
    host.addEventListener('pointerdown', onPointerDown, { passive: true, signal });
    host.addEventListener('pointerup', onPointerUp, { passive: true, signal });
    host.addEventListener('pointercancel', onPointerCancel, { signal });
    host.addEventListener('focusin', onFocusIn, { signal });
    host.addEventListener('focusout', onFocusOut, { signal });
    document.addEventListener('visibilitychange', onVisibilityChange, { signal });
    preference?.addEventListener('change', onReducedMotionChange, { signal });

    startedAt = performance.now();
    measure();

    if (prefersReduced()) {
      paintStatic();
    } else {
      paint(0, false);
      start();
    }

    return () => {
      closed = true;
      stop();
      controller.abort();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
    };
  }, [contentRef, pulseRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid={RADIAL_SPECTRUM_TESTID}
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full',
        className,
      )}
    />
  );
}
