import { describe, expect, it } from 'vitest';
import {
  RIDGE_CONTENT_CLEARANCE,
  RIDGE_EDGE_FADE_RATIO,
  RIDGE_FRONT_STROKE_WIDTH,
  RIDGE_STROKE_WIDTH,
  RIDGE_FALLBACK_PALETTE,
} from '@/lib/ridgeline';
import {
  buildRidgePoints,
  drawBackground,
  drawRidgelineScene,
  sampleXs,
  type RidgeCanvasContext,
  type RidgeFrame,
  type RidgePoint,
} from './hero-canvas-draw';

interface StrokeRecord {
  style: string;
  alpha: number;
  width: number;
  points: RidgePoint[];
}

interface FillRecord {
  x: number;
  y: number;
  width: number;
  height: number;
  style: string;
}

class FakeRidgeContext implements RidgeCanvasContext {
  globalAlpha = 1;
  lineWidth = 1;
  lineCap = '';
  lineJoin = '';
  strokeStyle = '';
  fillStyle = '';
  strokes: StrokeRecord[] = [];
  fills: FillRecord[] = [];
  private current: RidgePoint[] = [];

  beginPath(): void {
    this.current = [];
  }

  moveTo(x: number, y: number): void {
    this.current.push({ x, y });
  }

  lineTo(x: number, y: number): void {
    this.current.push({ x, y });
  }

  stroke(): void {
    this.strokes.push({
      style: this.strokeStyle,
      alpha: this.globalAlpha,
      width: this.lineWidth,
      points: this.current.slice(),
    });
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    this.fills.push({ x, y, width, height, style: this.fillStyle });
  }
}

const WIDTH = 1000;
const HEIGHT = 900;

function makeFrame(overrides: Partial<RidgeFrame> = {}): RidgeFrame {
  return {
    timeMs: 2100,
    band: { topY: 480, bottomY: 860 },
    lineCount: 9,
    sampleStep: 25,
    amplitude: 1,
    pointerX: -1,
    pointerY: -1,
    contentBottomY: 420,
    palette: RIDGE_FALLBACK_PALETTE,
    ...overrides,
  };
}

function maxAlpha(strokes: StrokeRecord[]): number {
  return strokes.reduce((max, stroke) => Math.max(max, stroke.alpha), 0);
}

function allPoints(strokes: StrokeRecord[]): RidgePoint[] {
  return strokes.flatMap((stroke) => stroke.points);
}

describe('ridgeline canvas sampling', () => {
  it('covers the full width and ends exactly on the right edge', () => {
    const xs = sampleXs(WIDTH, 25);
    expect(xs[0]).toBe(0);
    expect(xs[xs.length - 1]).toBe(WIDTH);
    expect(xs.length).toBe(41);
    expect(sampleXs(40, 100)).toEqual([0, 40]);
    expect(sampleXs(0, 25)).toEqual([0]);
  });
});

describe('ridgeline canvas background', () => {
  it('paints the token background over the whole canvas once', () => {
    const ctx = new FakeRidgeContext();
    drawBackground(ctx, WIDTH, HEIGHT, RIDGE_FALLBACK_PALETTE);

    expect(ctx.fills).toEqual([
      {
        x: 0,
        y: 0,
        width: WIDTH,
        height: HEIGHT,
        style: RIDGE_FALLBACK_PALETTE.background,
      },
    ]);
  });
});

describe('ridgeline canvas scene', () => {
  it('draws one visible polyline per ridge line', () => {
    const ctx = new FakeRidgeContext();
    drawRidgelineScene(ctx, WIDTH, HEIGHT, makeFrame());

    expect(ctx.fills).toHaveLength(1);
    expect(ctx.strokes.length).toBeGreaterThanOrEqual(9);
    expect(ctx.strokes.every((stroke) => stroke.points.length >= 2)).toBe(true);
    // The edge fade stays cheap: a bounded number of alpha runs per line.
    expect(ctx.strokes.length).toBeLessThanOrEqual(9 * 14);

    // Every line contributes one stroke through the solid middle of the hero.
    const solidFrom = WIDTH * (RIDGE_EDGE_FADE_RATIO + 0.02);
    const solidTo = WIDTH * (1 - RIDGE_EDGE_FADE_RATIO - 0.02);
    const fullWidthStrokes = ctx.strokes.filter(
      (stroke) =>
        Math.min(...stroke.points.map((point) => point.x)) <= solidFrom &&
        Math.max(...stroke.points.map((point) => point.x)) >= solidTo,
    );
    expect(fullWidthStrokes).toHaveLength(9);

    const baselines = new Set(
      fullWidthStrokes.map((stroke) => Math.max(...stroke.points.map((p) => p.y)).toFixed(3)),
    );
    expect(baselines.size).toBe(9);
  });

  it('keeps every stroke between the baseline and the hero content', () => {
    const frame = makeFrame();
    const ctx = new FakeRidgeContext();
    drawRidgelineScene(ctx, WIDTH, HEIGHT, frame);

    for (const point of allPoints(ctx.strokes)) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(WIDTH);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(frame.band.bottomY);
      expect(point.y).toBeGreaterThanOrEqual(
        frame.contentBottomY + RIDGE_CONTENT_CLEARANCE,
      );
    }
  });

  it('fades the ink back to front and marks the front line as lime', () => {
    const ctx = new FakeRidgeContext();
    drawRidgelineScene(ctx, WIDTH, HEIGHT, makeFrame());

    const byStyle = (style: string) =>
      ctx.strokes.filter((stroke) => stroke.style === style);

    const ink = byStyle('rgba(242, 241, 237, 1)');
    const lime = byStyle('rgba(168, 232, 92, 1)');

    expect(ink.length).toBeGreaterThan(0);
    expect(lime.length).toBeGreaterThan(0);
    expect(maxAlpha(ink)).toBeLessThan(maxAlpha(lime));
    expect(lime.every((stroke) => stroke.width === RIDGE_FRONT_STROKE_WIDTH)).toBe(true);
    expect(ink.every((stroke) => stroke.width === RIDGE_STROKE_WIDTH)).toBe(true);
  });

  it('never strokes the outer edges at full strength', () => {
    const ctx = new FakeRidgeContext();
    drawRidgelineScene(ctx, WIDTH, HEIGHT, makeFrame({ pointerX: 500, pointerY: 700 }));

    const strong = ctx.strokes.filter((stroke) => stroke.alpha > 0.2);
    expect(strong.length).toBeGreaterThan(0);

    for (const stroke of strong) {
      const xs = stroke.points.map((point) => point.x);
      expect(Math.min(...xs)).toBeGreaterThan(WIDTH * 0.01);
      expect(Math.max(...xs)).toBeLessThan(WIDTH * 0.99);
    }
  });

  it('is deterministic for a fixed frame, which is what reduced motion draws', () => {
    const frame = makeFrame({ pointerX: -1, pointerY: -1 });
    const first = new FakeRidgeContext();
    const second = new FakeRidgeContext();
    drawRidgelineScene(first, WIDTH, HEIGHT, frame);
    drawRidgelineScene(second, WIDTH, HEIGHT, frame);

    expect(second.strokes).toEqual(first.strokes);
  });

  it('skips lines that have no room below the hero content', () => {
    const partial = new FakeRidgeContext();
    drawRidgelineScene(partial, WIDTH, HEIGHT, makeFrame({ contentBottomY: 700 }));
    expect(partial.strokes.length).toBeGreaterThan(0);
    expect(partial.strokes.length).toBeLessThan(99);

    const none = new FakeRidgeContext();
    drawRidgelineScene(none, WIDTH, HEIGHT, makeFrame({ contentBottomY: 870 }));
    expect(none.strokes).toHaveLength(0);
    expect(none.fills).toHaveLength(1);
  });

  it('does nothing on a zero sized canvas', () => {
    const ctx = new FakeRidgeContext();
    expect(drawRidgelineScene(ctx, 0, HEIGHT, makeFrame())).toBe(0);
    expect(drawRidgelineScene(ctx, WIDTH, 0, makeFrame())).toBe(0);
    expect(ctx.fills).toHaveLength(0);
    expect(ctx.strokes).toHaveLength(0);
  });
});

describe('ridgeline line points', () => {
  it('lifts a line where the pointer is and leaves the rest alone', () => {
    const frame = makeFrame({ pointerX: 500, pointerY: 700 });
    const baseline = 700;
    const withPointer = buildRidgePoints(frame, 4, baseline, WIDTH);
    const withoutPointer = buildRidgePoints(
      makeFrame(),
      4,
      baseline,
      WIDTH,
    );

    expect(withPointer).not.toBeNull();
    expect(withoutPointer).not.toBeNull();

    const near = withPointer!.find((point) => Math.abs(point.x - 500) < 12)!;
    const far = withPointer!.find((point) => point.x === 750)!;
    const farReference = withoutPointer!.find((point) => point.x === 750)!;

    expect(near.y).toBeLessThan(far.y);
    expect(Math.abs(far.y - farReference.y)).toBeLessThan(0.01);
  });

  it('returns null when the content reaches the baseline', () => {
    expect(buildRidgePoints(makeFrame({ contentBottomY: 700 }), 4, 700, WIDTH)).toBeNull();
  });
});
