/**
 * Ridgeline canvas drawing.
 *
 * These functions take a minimal 2D context so they can be driven by a fake in
 * unit tests. Everything about where a line sits comes from `@/lib/ridgeline`,
 * so the geometry stays testable without a browser.
 */

import {
  RIDGE_ACCENT_OPACITY,
  RIDGE_EDGE_FADE_RATIO,
  RIDGE_FRONT_STROKE_WIDTH,
  RIDGE_STROKE_WIDTH,
  beatEnvelope,
  edgeFadeOpacity,
  hexToRgba,
  isFrontLine,
  lineBaselines,
  lineOpacity,
  pointerBump,
  ridgeHeight,
  ridgeHeightCeiling,
  type RidgeBand,
  type RidgePalette,
} from '@/lib/ridgeline';

export interface RidgePoint {
  x: number;
  y: number;
}

export interface RidgeFrame {
  /** Monotonic frame time in milliseconds. A fixed value gives a static frame. */
  timeMs: number;
  band: RidgeBand;
  lineCount: number;
  sampleStep: number;
  /** 1 at rest, eased up toward `RIDGE_HOVER_AMPLITUDE` while the pointer is over the hero. */
  amplitude: number;
  /** Canvas space pointer position, or -1 when the pointer is away. */
  pointerX: number;
  pointerY: number;
  contentBottomY: number;
  palette: RidgePalette;
}

/** The slice of the 2D context this module needs. */
export interface RidgeCanvasContext {
  globalAlpha: number;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  strokeStyle: string;
  fillStyle: string;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
  fillRect(x: number, y: number, width: number, height: number): void;
}

/** Alpha steps used when the stroke fades out toward the hero edges. */
const EDGE_ALPHA_STEP = 0.1;
const EDGE_ALPHA_FLOOR = 0.02;

export function sampleXs(width: number, sampleStep: number): number[] {
  const step = Math.max(2, Math.floor(sampleStep));
  const xs: number[] = [];
  for (let x = 0; x < width; x += step) xs.push(x);
  if (xs.length === 0 || xs[xs.length - 1] !== width) xs.push(width);
  return xs;
}

/**
 * A single ridge line. Returns null when there is no room left between the
 * baseline and the hero content, so no stroke is ever drawn over the text.
 */
export function buildRidgePoints(
  frame: RidgeFrame,
  index: number,
  baseline: number,
  width: number,
): RidgePoint[] | null {
  const ceiling = ridgeHeightCeiling(baseline, frame.contentBottomY);
  if (ceiling <= 0) return null;

  const beat = beatEnvelope(frame.timeMs);
  const t = frame.timeMs / 1000;
  const pointerActive = frame.pointerX >= 0 && frame.pointerY >= 0;
  const pointerDistance = pointerActive ? Math.abs(baseline - frame.pointerY) : 0;

  return sampleXs(width, frame.sampleStep).map((x) => {
    let height = ridgeHeight({
      x,
      width,
      t,
      index,
      beat,
      amplitude: frame.amplitude,
    });

    if (pointerActive) {
      height += pointerBump(x, frame.pointerX, pointerDistance);
    }

    const clamped = Math.min(height, ceiling);
    return { x, y: Math.max(0, baseline - clamped) };
  });
}

function quantizeAlpha(value: number): number {
  return Math.max(
    0,
    Math.min(1, Math.round(value / EDGE_ALPHA_STEP) * EDGE_ALPHA_STEP),
  );
}

function strokePoints(ctx: RidgeCanvasContext, points: RidgePoint[], from: number, to: number) {
  ctx.beginPath();
  ctx.moveTo(points[from].x, points[from].y);
  for (let index = from + 1; index <= to; index += 1) {
    ctx.lineTo(points[index].x, points[index].y);
  }
  ctx.stroke();
}

/**
 * Strokes a line in alpha runs so it fades in and out at the hero edges without
 * a gradient. Consecutive samples with the same quantized alpha are stroked as
 * one path, so most of the line is a single stroke.
 */
export function strokeEdgeFadedPath(
  ctx: RidgeCanvasContext,
  points: RidgePoint[],
  alpha: number,
  width: number,
): number {
  if (points.length < 2) return 0;

  const edge = width * RIDGE_EDGE_FADE_RATIO;
  let strokes = 0;
  let runStart = 0;
  let runAlpha = -1;

  const flush = (endIndex: number) => {
    if (runAlpha <= EDGE_ALPHA_FLOOR || endIndex <= runStart) return;
    ctx.globalAlpha = alpha * runAlpha;
    strokePoints(ctx, points, runStart, endIndex);
    strokes += 1;
  };

  for (let index = 0; index < points.length - 1; index += 1) {
    const midpoint = (points[index].x + points[index + 1].x) / 2;
    const alphaHere = quantizeAlpha(edgeFadeOpacity(midpoint, width, RIDGE_EDGE_FADE_RATIO));

    if (alphaHere !== runAlpha) {
      flush(index);
      runStart = index;
      runAlpha = alphaHere;
    }
  }

  flush(points.length - 1);
  return strokes;
}

export function drawBackground(
  ctx: RidgeCanvasContext,
  width: number,
  height: number,
  palette: RidgePalette,
): void {
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, width, height);
}

export function drawRidgelineScene(
  ctx: RidgeCanvasContext,
  width: number,
  height: number,
  frame: RidgeFrame,
): number {
  if (width <= 0 || height <= 0) return 0;

  drawBackground(ctx, width, height, frame.palette);

  const baselines = lineBaselines(frame.band, frame.lineCount);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let strokes = 0;

  for (let index = 0; index < baselines.length; index += 1) {
    const points = buildRidgePoints(frame, index, baselines[index], width);
    if (!points) continue;

    const front = isFrontLine(index, frame.lineCount);
    const base = front ? RIDGE_ACCENT_OPACITY : lineOpacity(index, frame.lineCount);

    ctx.strokeStyle = hexToRgba(front ? frame.palette.accent : frame.palette.ink, 1);
    ctx.lineWidth = front ? RIDGE_FRONT_STROKE_WIDTH : RIDGE_STROKE_WIDTH;

    strokes += strokeEdgeFadedPath(ctx, points, base, width);
  }

  // The fade is quantized over the whole line, so no stroke ever carries the
  // full alpha all the way to an edge.
  ctx.globalAlpha = 1;
  return strokes;
}
