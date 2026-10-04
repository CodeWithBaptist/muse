import { describe, expect, it } from 'vitest';
import {
  SPECTRUM_BARS_NARROW,
  SPECTRUM_BARS_WIDE,
  SPECTRUM_BEAT_MS,
  SPECTRUM_CONTENT_PADDING,
  SPECTRUM_EDGE_MARGIN,
  SPECTRUM_FALLBACK_PALETTE,
  SPECTRUM_HOVER_AMPLITUDE,
  SPECTRUM_IDLE_OPACITY,
  SPECTRUM_INTRO_BUILD_MS,
  SPECTRUM_INTRO_START_MS,
  SPECTRUM_MIN_BAR_LENGTH,
  SPECTRUM_OPACITY_BUCKETS,
  SPECTRUM_RING_MIN_FRACTION,
  SPECTRUM_RING_PADDING,
  SPECTRUM_STATIC_BEAT,
  SPECTRUM_STROKE_WIDTH,
  SPECTRUM_TRAIL_LENGTH,
  angleDifference,
  barCountForWidth,
  barLength,
  barVariation,
  beatEnvelope,
  beatPhase,
  buildBars,
  clampBarToHero,
  drawRadialSpectrum,
  easeAmplitude,
  ellipseNormal,
  ellipsePoint,
  introProgress,
  isTrailBar,
  nextBarCount,
  pointInExpandedRect,
  pointerPull,
  quantizeOpacity,
  readSpectrumPalette,
  ringForRect,
  staticSpectrumFrame,
  trailOpacity,
  type Point,
  type RadialFrame,
  type Rect,
  type SpectrumCanvasContext,
} from './radial-spectrum';

interface StrokeRecord {
  style: string;
  alpha: number;
  width: number;
  cap: string;
  points: Point[];
}

class FakeContext implements SpectrumCanvasContext {
  globalAlpha = 1;
  lineWidth = 1;
  lineCap = '';
  strokeStyle = '';
  strokes: StrokeRecord[] = [];
  clears: Array<{ x: number; y: number; width: number; height: number }> = [];
  private current: Point[] = [];

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
      cap: this.lineCap,
      points: this.current.slice(),
    });
  }

  clearRect(x: number, y: number, width: number, height: number): void {
    this.clears.push({ x, y, width, height });
  }
}

const HERO = { width: 1440, height: 720 };
const CONTENT: Rect = { left: 420, top: 220, width: 600, height: 260 };

function makeFrame(overrides: Partial<RadialFrame> = {}): RadialFrame {
  return {
    width: HERO.width,
    height: HERO.height,
    ring: ringForRect(CONTENT, HERO.width, HERO.height),
    contentRect: CONTENT,
    timeMs: SPECTRUM_INTRO_START_MS + SPECTRUM_INTRO_BUILD_MS + 400,
    amplitude: 1,
    barCount: SPECTRUM_BARS_WIDE,
    pointerAngle: null,
    static: false,
    ...overrides,
  };
}

function makeStaticFrame(overrides: Partial<RadialFrame> = {}): RadialFrame {
  return {
    ...staticSpectrumFrame(
      HERO.width,
      HERO.height,
      ringForRect(CONTENT, HERO.width, HERO.height),
      CONTENT,
      SPECTRUM_BARS_WIDE,
    ),
    ...overrides,
  };
}

describe('radial spectrum ring geometry', () => {
  it('places the ring 40px outside the content and keeps a floor', () => {
    const minimum = Math.min(HERO.width, HERO.height) * SPECTRUM_RING_MIN_FRACTION;
    const ring = ringForRect(CONTENT, HERO.width, HERO.height);
    expect(ring.cx).toBe(720);
    expect(ring.cy).toBe(350);
    expect(ring.rx).toBe(CONTENT.width / 2 + SPECTRUM_RING_PADDING);
    // The floor wins on the short axis: 180 beats 130 + 40.
    expect(ring.ry).toBe(minimum);
    expect(ring.ry).toBeGreaterThan(CONTENT.height / 2);

    // A tiny content block on a small hero still gets a visible ring.
    const small = ringForRect({ left: 10, top: 10, width: 40, height: 40 }, HERO.width, HERO.height);
    expect(small.rx).toBe(minimum);
    expect(small.ry).toBe(minimum);
  });

  it('walks an ellipse and returns a unit outward normal', () => {
    const ring = { cx: 100, cy: 50, rx: 200, ry: 100 };
    expect(ellipsePoint(ring, 0)).toEqual({ x: 300, y: 50 });
    expect(ellipsePoint(ring, Math.PI / 2).x).toBeCloseTo(100, 6);
    expect(ellipsePoint(ring, Math.PI / 2).y).toBeCloseTo(150, 6);

    for (const angle of [0, 0.4, 1.2, 3, 4.5, 6]) {
      const normal = ellipseNormal(ring, angle);
      expect(Math.hypot(normal.x, normal.y)).toBeCloseTo(1, 9);
    }

    const east = ellipseNormal(ring, 0);
    expect(east.x).toBeCloseTo(1, 9);
    expect(east.y).toBeCloseTo(0, 9);

    const south = ellipseNormal(ring, Math.PI / 2);
    expect(south.x).toBeCloseTo(0, 9);
    expect(south.y).toBeCloseTo(1, 9);
  });

  it('wraps angles and differences', () => {
    expect(angleDifference(0.2, -0.2)).toBeCloseTo(0.4, 9);
    expect(angleDifference(-3.1, 3.1)).toBeCloseTo(0.0831853, 6);
    expect(Math.abs(angleDifference(0, Math.PI * 2))).toBeLessThan(1e-9);
  });
});

describe('radial spectrum bar length', () => {
  it('keeps the variation inside [0, 1]', () => {
    for (let index = 0; index < SPECTRUM_BARS_WIDE; index += 1) {
      const value = barVariation(index, index * 0.03);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('grows with the beat, the amplitude, and the variation', () => {
    const base = { variation: 0.5, amplitude: 1, minDimension: 720 };
    const quiet = barLength({ ...base, beat: 0 });
    const loud = barLength({ ...base, beat: 1 });
    expect(loud).toBeGreaterThan(quiet);

    const hovered = barLength({ ...base, beat: 0.5, amplitude: SPECTRUM_HOVER_AMPLITUDE });
    const resting = barLength({ ...base, beat: 0.5 });
    expect(hovered).toBeGreaterThan(resting);

    const low = barLength({ variation: 0, beat: 0.5, amplitude: 1, minDimension: 720 });
    const high = barLength({ variation: 1, beat: 0.5, amplitude: 1, minDimension: 720 });
    expect(high).toBeGreaterThan(low);
    // Even a dead quiet bar keeps the 6px base stroke.
    expect(low).toBeGreaterThan(6);
    expect(low).toBeLessThan(40);
    expect(high).toBeLessThan(120);
  });

  it('shortens with the hero and never goes negative', () => {
    expect(barLength({ variation: 1, beat: 1, amplitude: 1, minDimension: 320 })).toBeLessThan(
      barLength({ variation: 1, beat: 1, amplitude: 1, minDimension: 1440 }),
    );
  });

  it('pulls bars toward the pointer with a narrow falloff', () => {
    const peak = pointerPull(0, 720);
    expect(peak).toBeCloseTo(72, 6);
    expect(pointerPull(SPECTRUM_TRAIL_LENGTH, 720)).toBeLessThan(peak);
    expect(pointerPull(1, 720)).toBeLessThan(peak * 0.02);
    expect(pointerPull(Math.PI, 720)).toBeLessThan(1e-6);
  });
});

describe('radial spectrum trail', () => {
  it('is brightest at the head, fades across the sweep, then goes idle', () => {
    expect(trailOpacity(0)).toBeGreaterThan(trailOpacity(0.5));
    expect(trailOpacity(0.5)).toBeGreaterThan(trailOpacity(1.4));
    expect(trailOpacity(SPECTRUM_TRAIL_LENGTH)).toBe(SPECTRUM_IDLE_OPACITY);
    expect(trailOpacity(4)).toBe(SPECTRUM_IDLE_OPACITY);
    expect(trailOpacity(0)).toBeLessThanOrEqual(1);
  });

  it('marks only the bars inside the sweep as lime', () => {
    expect(isTrailBar(0)).toBe(true);
    expect(isTrailBar(1.49)).toBe(true);
    expect(isTrailBar(1.5)).toBe(false);
  });
});

describe('radial spectrum text safety and clamping', () => {
  it('does not draw a bar whose midpoint lands over the content', () => {
    expect(
      pointInExpandedRect({ x: CONTENT.left + 10, y: CONTENT.top + 10 }, CONTENT),
    ).toBe(true);
    // 16px of padding on every side.
    expect(
      pointInExpandedRect(
        { x: CONTENT.left - SPECTRUM_CONTENT_PADDING + 0.5, y: CONTENT.top - 1 },
        CONTENT,
      ),
    ).toBe(true);
    expect(
      pointInExpandedRect(
        { x: CONTENT.left - SPECTRUM_CONTENT_PADDING - 1, y: CONTENT.top },
        CONTENT,
      ),
    ).toBe(false);
    expect(pointInExpandedRect({ x: 0, y: 0 }, CONTENT)).toBe(false);
  });

  it('shortens a bar so it stays inside the hero with a margin', () => {
    const clamped = clampBarToHero({ x: 900, y: 400 }, { x: 1500, y: 400 }, HERO.width, HERO.height);
    expect(clamped.end.x).toBe(HERO.width - SPECTRUM_EDGE_MARGIN);
    expect(clamped.length).toBe(HERO.width - SPECTRUM_EDGE_MARGIN - 900);

    const diagonal = clampBarToHero({ x: 100, y: 100 }, { x: -200, y: -200 }, HERO.width, HERO.height);
    expect(diagonal.end.x).toBeGreaterThanOrEqual(SPECTRUM_EDGE_MARGIN - 1e-9);
    expect(diagonal.end.y).toBeGreaterThanOrEqual(SPECTRUM_EDGE_MARGIN - 1e-9);

    const inside = clampBarToHero({ x: 400, y: 300 }, { x: 500, y: 340 }, HERO.width, HERO.height);
    expect(inside.end).toEqual({ x: 500, y: 340 });
    expect(inside.length).toBeCloseTo(Math.hypot(100, 40), 9);

    // A bar that starts outside the hero has no room at all.
    const none = clampBarToHero(
      { x: HERO.width + 50, y: 300 },
      { x: HERO.width + 150, y: 300 },
      HERO.width,
      HERO.height,
    );
    expect(none.length).toBe(0);
  });
});

describe('radial spectrum intro build', () => {
  it('holds at zero until the headline reveal has begun', () => {
    expect(introProgress(0, SPECTRUM_BARS_WIDE, 0)).toBe(0);
    expect(introProgress(0, SPECTRUM_BARS_WIDE, SPECTRUM_INTRO_START_MS - 1)).toBe(0);
    expect(introProgress(0, SPECTRUM_BARS_WIDE, SPECTRUM_INTRO_START_MS + 40)).toBeGreaterThan(0);
  });

  it('builds in clockwise, so the first bar leads the last', () => {
    const middle = SPECTRUM_INTRO_START_MS + 1000;
    expect(introProgress(0, SPECTRUM_BARS_WIDE, middle)).toBeGreaterThan(
      introProgress(SPECTRUM_BARS_WIDE - 1, SPECTRUM_BARS_WIDE, middle),
    );
    expect(introProgress(SPECTRUM_BARS_WIDE - 1, SPECTRUM_BARS_WIDE, middle)).toBeGreaterThan(0);
    expect(introProgress(SPECTRUM_BARS_WIDE - 1, SPECTRUM_BARS_WIDE, middle)).toBeLessThan(1);
  });

  it('settles the whole ring within the build window', () => {
    const settled = SPECTRUM_INTRO_START_MS + SPECTRUM_INTRO_BUILD_MS;
    for (const index of [0, 40, SPECTRUM_BARS_WIDE - 1]) {
      expect(introProgress(index, SPECTRUM_BARS_WIDE, settled)).toBe(1);
      expect(introProgress(index, SPECTRUM_BARS_WIDE, settled + 500)).toBe(1);
    }
  });
});

describe('radial spectrum beat', () => {
  it('runs at 96 BPM with a decaying envelope', () => {
    expect(SPECTRUM_BEAT_MS).toBe(625);
    expect(beatPhase(0)).toBe(0);
    expect(beatEnvelope(0)).toBeCloseTo(1, 9);
    expect(beatEnvelope(SPECTRUM_BEAT_MS / 2)).toBeCloseTo(Math.exp(-2.75), 9);
    expect(beatEnvelope(SPECTRUM_BEAT_MS)).toBeCloseTo(1, 9);
    expect(beatEnvelope(SPECTRUM_BEAT_MS * 3)).toBeCloseTo(1, 9);
    expect(beatEnvelope(SPECTRUM_BEAT_MS * 0.9)).toBeLessThan(0.05);
  });

  it('eases the hover amplitude about 6 percent per frame', () => {
    const next = easeAmplitude(1, SPECTRUM_HOVER_AMPLITUDE);
    expect(next).toBeCloseTo(1 + (SPECTRUM_HOVER_AMPLITUDE - 1) * 0.06, 9);
    expect(easeAmplitude(SPECTRUM_HOVER_AMPLITUDE - 0.0001, SPECTRUM_HOVER_AMPLITUDE)).toBe(
      SPECTRUM_HOVER_AMPLITUDE,
    );
    expect(easeAmplitude(1.8, 1)).toBeLessThan(1.8);
  });

  it('quantizes opacities into at most eight buckets', () => {
    const values = new Set<number>();
    for (let behind = 0; behind < SPECTRUM_TRAIL_LENGTH; behind += 0.01) {
      values.add(quantizeOpacity(trailOpacity(behind)));
    }
    values.add(quantizeOpacity(SPECTRUM_IDLE_OPACITY));
    expect(values.size).toBeLessThanOrEqual(SPECTRUM_OPACITY_BUCKETS);
    expect(quantizeOpacity(0.2)).toBe(0.25);
    expect(quantizeOpacity(4)).toBe(1);
    expect(quantizeOpacity(-4)).toBe(0);
  });

  it('drops the bar count on a wide hero and on narrow screens', () => {
    expect(barCountForWidth(1440)).toBe(SPECTRUM_BARS_WIDE);
    expect(barCountForWidth(640)).toBe(SPECTRUM_BARS_WIDE);
    expect(barCountForWidth(639)).toBe(SPECTRUM_BARS_NARROW);
    expect(barCountForWidth(320)).toBe(SPECTRUM_BARS_NARROW);
  });

  it('only ever reduces the bar count when frames run long', () => {
    expect(nextBarCount(SPECTRUM_BARS_WIDE, 16)).toBe(SPECTRUM_BARS_WIDE);
    expect(nextBarCount(SPECTRUM_BARS_WIDE, 30)).toBe(96);
    expect(nextBarCount(SPECTRUM_BARS_NARROW, 30, SPECTRUM_BARS_NARROW)).toBeLessThan(
      SPECTRUM_BARS_NARROW,
    );
    // The narrow layout has its own ladder, and it bottoms out at 72.
    expect(nextBarCount(72, 30, SPECTRUM_BARS_NARROW)).toBe(58);
    expect(nextBarCount(72, 30)).toBe(72);
  });
});

describe('radial spectrum bars', () => {
  it('never puts a bar midpoint over the content or outside the hero', () => {
    for (const timeMs of [2300, 2400, 6000, 12000]) {
      const bars = buildBars(makeFrame({ timeMs }));
      expect(bars.length).toBeGreaterThan(SPECTRUM_BARS_WIDE * 0.5);

      for (const bar of bars) {
        const midpoint = {
          x: (bar.start.x + bar.end.x) / 2,
          y: (bar.start.y + bar.end.y) / 2,
        };
        expect(pointInExpandedRect(midpoint, CONTENT)).toBe(false);
        for (const point of [bar.start, bar.end]) {
          expect(point.x).toBeGreaterThanOrEqual(SPECTRUM_EDGE_MARGIN - 1e-6);
          expect(point.x).toBeLessThanOrEqual(HERO.width - SPECTRUM_EDGE_MARGIN + 1e-6);
          expect(point.y).toBeGreaterThanOrEqual(SPECTRUM_EDGE_MARGIN - 1e-6);
          expect(point.y).toBeLessThanOrEqual(HERO.height - SPECTRUM_EDGE_MARGIN + 1e-6);
        }
        expect(bar.length).toBeGreaterThanOrEqual(SPECTRUM_MIN_BAR_LENGTH);
      }
    }
  });

  it('draws nothing before the intro, then builds the ring in clockwise', () => {
    expect(buildBars(makeFrame({ timeMs: 0 }))).toHaveLength(0);
    expect(buildBars(makeFrame({ timeMs: SPECTRUM_INTRO_START_MS - 10 }))).toHaveLength(0);

    const early = buildBars(makeFrame({ timeMs: SPECTRUM_INTRO_START_MS + 200 }));
    expect(early.length).toBeGreaterThan(0);
    expect(early.length).toBeLessThan(SPECTRUM_BARS_WIDE);
    expect(early.every((bar) => bar.index < SPECTRUM_BARS_WIDE * 0.5)).toBe(true);

    const settled = buildBars(
      makeFrame({ timeMs: SPECTRUM_INTRO_START_MS + SPECTRUM_INTRO_BUILD_MS + 10 }),
    );
    expect(settled.length).toBeGreaterThan(early.length);
  });

  it('colours the sweep lime and keeps the rest faint ink', () => {
    const bars = buildBars(makeFrame({ timeMs: 4000 }));
    const lime = bars.filter((bar) => bar.lime);
    const ink = bars.filter((bar) => !bar.lime);

    expect(lime.length).toBeGreaterThan(0);
    expect(ink.length).toBeGreaterThan(lime.length);
    expect(lime.every((bar) => bar.opacity > SPECTRUM_IDLE_OPACITY)).toBe(true);
    expect(ink.every((bar) => bar.opacity === SPECTRUM_IDLE_OPACITY)).toBe(true);
    // The lime sweep stays a small part of the ring, by design.
    expect(lime.length).toBeLessThan(bars.length * 0.3);
  });

  it('pulls the bars facing the pointer and leaves the others alone', () => {
    const pointerAngle = -Math.PI / 2;
    const withPointer = buildBars(makeFrame({ timeMs: 4000, pointerAngle }));
    const without = buildBars(makeFrame({ timeMs: 4000 }));
    const byIndex = new Map(without.map((bar) => [bar.index, bar]));

    let longer = 0;
    let same = 0;
    for (const bar of withPointer) {
      const reference = byIndex.get(bar.index);
      if (!reference) continue;
      if (bar.length > reference.length + 0.05) longer += 1;
      if (Math.abs(bar.length - reference.length) < 1e-9) same += 1;
    }
    expect(longer).toBeGreaterThan(1);
    expect(same).toBeGreaterThan(longer);
  });

  it('makes the hover amplitude visibly longer', () => {
    const resting = buildBars(makeFrame({ timeMs: 4000, amplitude: 1 }));
    const hovered = buildBars(makeFrame({ timeMs: 4000, amplitude: SPECTRUM_HOVER_AMPLITUDE }));
    const restingLength = resting.reduce((total, bar) => total + bar.length, 0);
    const hoveredLength = hovered.reduce((total, bar) => total + bar.length, 0);
    expect(hoveredLength).toBeGreaterThan(restingLength * 1.05);
  });

  it('gives reduced motion one deterministic frame with no pointer pull', () => {
    const first = buildBars(makeStaticFrame({ pointerAngle: 0.3 }));
    const second = buildBars(makeStaticFrame({ pointerAngle: 0.3 }));
    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual(first);

    const beat = barLength({
      variation: barVariation(3, 0),
      beat: SPECTRUM_STATIC_BEAT,
      amplitude: 1,
      minDimension: Math.min(HERO.width, HERO.height),
    });
    const bar = first.find((candidate) => candidate.index === 3);
    expect(bar).toBeDefined();
    expect(bar?.start.x).toBeCloseTo(
      ellipsePoint(makeStaticFrame().ring, (3 / SPECTRUM_BARS_WIDE) * Math.PI * 2).x,
      6,
    );
    expect(beat).toBeGreaterThan(0);
    // No rotation: every bar sits on its base ellipse angle.
    expect(first[0].angle).toBe(0);
  });

  it('drops bars when the content box reaches the ring', () => {
    const tall: Rect = { left: 0, top: 0, width: HERO.width, height: HERO.height - 40 };
    const bars = buildBars(makeFrame({ contentRect: tall }));
    expect(bars.length).toBeLessThan(SPECTRUM_BARS_WIDE);
  });

  it('does nothing on a zero sized hero', () => {
    expect(buildBars(makeFrame({ width: 0 }))).toEqual([]);
    expect(buildBars(makeFrame({ height: 0 }))).toEqual([]);
  });
});

describe('radial spectrum drawing', () => {
  it('clears the canvas and batches strokes into buckets', () => {
    const ctx = new FakeContext();
    const strokes = drawRadialSpectrum(ctx, makeFrame({ timeMs: 4000 }));

    expect(ctx.clears).toEqual([
      { x: 0, y: 0, width: HERO.width, height: HERO.height },
    ]);
    expect(strokes).toBeGreaterThan(0);
    expect(strokes).toBeLessThanOrEqual(SPECTRUM_OPACITY_BUCKETS * 2);
    expect(ctx.strokes).toHaveLength(strokes);
    expect(ctx.strokes.every((stroke) => stroke.width === SPECTRUM_STROKE_WIDTH)).toBe(true);
    expect(ctx.strokes.every((stroke) => stroke.cap === 'round')).toBe(true);
    expect(ctx.strokes.every((stroke) => stroke.alpha > 0 && stroke.alpha <= 1)).toBe(true);
    expect(ctx.strokes.every((stroke) => stroke.points.length >= 2)).toBe(true);
    expect(ctx.globalAlpha).toBe(1);
  });

  it('draws the ink before the lime trail', () => {
    const ctx = new FakeContext();
    drawRadialSpectrum(ctx, makeFrame({ timeMs: 4000 }));

    const firstLime = ctx.strokes.findIndex((stroke) =>
      stroke.style.startsWith('rgba(168, 232, 92'),
    );
    const lastInk = ctx.strokes
      .map((stroke) => stroke.style)
      .lastIndexOf('rgba(242, 241, 237, 1)');
    expect(firstLime).toBeGreaterThan(-1);
    expect(lastInk).toBeGreaterThan(-1);
    expect(firstLime).toBeGreaterThan(lastInk);
  });

  it('uses the design token colours', () => {
    const ctx = new FakeContext();
    drawRadialSpectrum(ctx, makeFrame({ timeMs: 4000 }));
    const styles = new Set(ctx.strokes.map((stroke) => stroke.style));
    expect(styles.has('rgba(242, 241, 237, 1)')).toBe(true);
    expect(styles.has('rgba(168, 232, 92, 1)')).toBe(true);
  });

  it('reads the tokens from the document, with token fallbacks', () => {
    const palette = readSpectrumPalette({
      getPropertyValue: (property: string) =>
        property === '--color-accent' ? '#A8E85C' : '',
    });
    expect(palette.accent).toBe('#A8E85C');
    expect(palette.ink).toBe(SPECTRUM_FALLBACK_PALETTE.ink);
  });

  it('paints a deterministic reduced motion frame', () => {
    const first = new FakeContext();
    const second = new FakeContext();
    drawRadialSpectrum(first, makeStaticFrame());
    drawRadialSpectrum(second, makeStaticFrame());
    expect(second.strokes).toEqual(first.strokes);
    expect(first.strokes.length).toBeGreaterThan(0);
  });

  it('moves between frames, so the loop has something to draw', () => {
    const first = new FakeContext();
    const second = new FakeContext();
    drawRadialSpectrum(first, makeFrame({ timeMs: 4000 }));
    drawRadialSpectrum(second, makeFrame({ timeMs: 4100 }));
    expect(second.strokes).not.toEqual(first.strokes);
  });

  it('does nothing on a zero sized canvas', () => {
    const ctx = new FakeContext();
    expect(drawRadialSpectrum(ctx, makeFrame({ width: 0 }))).toBe(0);
    expect(drawRadialSpectrum(ctx, makeFrame({ height: 0 }))).toBe(0);
    expect(ctx.strokes).toHaveLength(0);
  });
});
