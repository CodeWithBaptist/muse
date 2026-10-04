'use client';

import { useEffect, useRef, type CSSProperties, type RefObject } from 'react';
import {
  RIDGE_FALLBACK_PALETTE,
  RIDGE_HOVER_AMPLITUDE,
  easeAmplitude,
  nextQualityLevel,
  readRidgePalette,
  ridgeBand,
  ridgeLayout,
  type RidgePalette,
} from '@/lib/ridgeline';
import {
  drawRidgelineScene,
  type RidgeCanvasContext,
  type RidgeFrame,
} from './hero-canvas-draw';

export const RIDGE_CANVAS_TESTID = 'ridgeline-canvas';

/** Pose used when motion is reduced: one static frame, no loop. */
const STATIC_FRAME_MS = 2400;
const DPR_CAP = 2;
const POINTER_OFF = -1;
const FRAME_WINDOW = 30;
const RECT_REFRESH_MS = 100;

export interface RidgelineCanvasProps {
  /** The hero content; the ridge band is placed below its bottom edge. */
  contentRef?: RefObject<HTMLElement | null>;
  className?: string;
  style?: CSSProperties;
}

export function RidgelineCanvas({
  contentRef,
  className,
  style,
}: RidgelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const ctx = context as unknown as RidgeCanvasContext;
    const reducedQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    const prefersReduced = () => reducedQuery?.matches ?? false;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let palette: RidgePalette = RIDGE_FALLBACK_PALETTE;
    let contentBottomY = 0;
    let layout = ridgeLayout(0);
    let qualityLevel = 0;
    let amplitude = 1;
    let pointerX = POINTER_OFF;
    let pointerY = POINTER_OFF;
    let visible = true;
    let frameHandle = 0;
    let closed = false;
    let lastFrameTime = 0;
    let frameDurations: number[] = [];
    let rectReadAt = 0;
    let cachedRect = { left: 0, top: 0, width: 0, height: 0 };

    /** Cached so pointer moves do not force layout on every event. */
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

    const measure = () => {
      const box = readRect(true);
      width = Math.max(0, Math.round(box.width));
      height = Math.max(0, Math.round(box.height));
      dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);

      const backingWidth = Math.max(1, Math.round(width * dpr));
      const backingHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== backingWidth) canvas.width = backingWidth;
      if (canvas.height !== backingHeight) canvas.height = backingHeight;

      layout = ridgeLayout(width, qualityLevel);
      palette = readRidgePalette(window.getComputedStyle(canvas));

      const content = contentRef?.current;
      contentBottomY = content
        ? Math.max(0, content.getBoundingClientRect().bottom - box.top)
        : 0;
    };

    const buildFrame = (timeMs: number): RidgeFrame => ({
      timeMs,
      band: ridgeBand(height, contentBottomY),
      lineCount: layout.lineCount,
      sampleStep: layout.sampleStep,
      amplitude,
      pointerX,
      pointerY,
      contentBottomY,
      palette,
    });

    const paint = (timeMs: number) => {
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRidgelineScene(ctx, width, height, buildFrame(timeMs));
    };

    const paintStatic = () => {
      measure();
      amplitude = 1;
      pointerX = POINTER_OFF;
      pointerY = POINTER_OFF;
      paint(STATIC_FRAME_MS);
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
          const nextLevel = nextQualityLevel(qualityLevel, average);
          if (nextLevel !== qualityLevel) {
            qualityLevel = nextLevel;
            layout = ridgeLayout(width, qualityLevel);
          }
        }
      }

      lastFrameTime = now;
      amplitude = easeAmplitude(
        amplitude,
        pointerX === POINTER_OFF ? 1 : RIDGE_HOVER_AMPLITUDE,
      );
      paint(now);
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

    const onPointerMove = (event: PointerEvent) => {
      const box = readRect();

      const x = event.clientX - box.left;
      const y = event.clientY - box.top;

      if (x < 0 || y < 0 || x > box.width || y > box.height) {
        pointerX = POINTER_OFF;
        pointerY = POINTER_OFF;
        return;
      }

      pointerX = x;
      pointerY = y;
    };

    const onPointerLeave = () => {
      pointerX = POINTER_OFF;
      pointerY = POINTER_OFF;
    };

    const onVisibilityChange = () => {
      lastFrameTime = 0;
    };

    const onReducedMotionChange = () => {
      if (prefersReduced()) {
        stop();
        paintStatic();
      } else {
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
    resizeObserver?.observe(canvas);

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
    intersectionObserver?.observe(canvas);

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibilityChange);
    reducedQuery?.addEventListener('change', onReducedMotionChange);

    if (prefersReduced()) {
      paintStatic();
    } else {
      measure();
      paint(performance.now());
      start();
    }

    return () => {
      closed = true;
      stop();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reducedQuery?.removeEventListener('change', onReducedMotionChange);
    };
  }, [contentRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid={RIDGE_CANVAS_TESTID}
      style={style}
      className={[
        'pointer-events-none absolute inset-0 h-full w-full',
        className ?? '',
      ]
        .join(' ')
        .trim()}
    />
  );
}
