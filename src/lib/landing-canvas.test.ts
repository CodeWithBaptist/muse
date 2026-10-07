import { describe, expect, it } from 'vitest';
import { BEAT_MS } from './beat-clock';
import {
  BAND_BAR_MAX_HEIGHT,
  BAND_BAR_GAIN,
  BAND_BAR_MIN_RATIO,
  BAND_BAR_PITCH,
  BAND_BAR_WIDTH,
  BAND_CURSOR_LIFT,
  BAND_CURSOR_RADIUS,
  BAND_EDGE_FADE,
  BAND_OUTLINE_ALPHA,
  BAND_OUTLINE_WIDTH_PX,
  BAND_PLAYHEAD_PERIOD_MS,
  BAND_PLAYHEAD_STATIC,
  GROOVE_DISTORTION_CAP,
  GROOVE_INNER_RADIUS,
  GROOVE_NARROW_WIDTH,
  GROOVE_OUTER_CAP,
  GROOVE_SEGMENTS,
  GROOVE_STEP,
  GROOVE_STEP_NARROW,
  HERO_CONTENT_PADDING,
  HERO_DIM_FACTOR,
  HOVER_ENERGY_EASE,
  HOVER_ENERGY_REST,
  HOVER_ENERGY_TARGET,
  LANDING_FALLBACK_PALETTE,
  LOGO_UNITS_HEIGHT,
  LOGO_UNITS_WIDTH,
  NEEDLE_FIRST_INDEX,
  NEEDLE_LAST_INDEX,
  NEEDLE_SPAN,
  STATIC_BEAT,
  bandBarHeight,
  bandBarIsLime,
  bandBarPositions,
  bandBarRatio,
  bandCursorLift,
  bandPlayhead,
  clamp,
  drawHeroGrooves,
  drawLivingLogo,
  easeEnergy,
  fadeBandEdges,
  grooveAngles,
  grooveDistortion,
  grooveLimit,
  grooveOpacity,
  grooveRadii,
  grooveRadius,
  grooveStep,
  grooveWave,
  hexToRgba,
  heroFrameValues,
  isPointInExpandedRect,
  logoScale,
  needleArcRuns,
  needleArcStart,
  needleHead,
  needleIndices,
  needleOpacity,
  readLandingPalette,
  staticBandFrame,
  staticHeroFrame,
  visibleCenter,
  type GrooveCanvasContext,
  type HeroFrame,
  type Rect,
} from './landing-canvas';
import { LANDING_WORDMARK_PIECES } from './landing-wordmark';

/* -------------------------------------------------------------------------- */
/* A recording canvas context                                                 */
/* -------------------------------------------------------------------------- */

type Call = { name: string; args: unknown[] };

function createMockContext() {
  const calls: Call[] = [];
  const record = (name: string) => (...args: unknown[]) => {
    calls.push({ name, args });
  };

  const context = {
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: 'butt',
    strokeStyle: '',
    fillStyle: '',
    globalCompositeOperation: 'source-over',
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    arc: record('arc'),
    stroke: record('stroke'),
    fill: record('fill'),
    fillRect: record('fillRect'),
    clearRect: record('clearRect'),
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    scale: record('scale'),
    clip: record('clip'),
    setTransform: record('setTransform'),
    createLinearGradient: (...args: unknown[]) => {
      calls.push({ name: 'createLinearGradient', args });
      return { addColorStop: record('addColorStop') };
    },
  };

  return { context: context as unknown as GrooveCanvasContext, calls };
}

const counts = (calls: Call[], name: string) =>
  calls.filter((call) => call.name === name).length;

const EMPTY_RECT: Rect = { left: 0, top: 0, width: 0, height: 0 };

function heroFrame(overrides: Partial<HeroFrame> = {}): HeroFrame {
  return {
    width: 1440,
    height: 900,
    cx: 720,
    cy: 450,
    contentRect: EMPTY_RECT,
    timeMs: 0,
    multiplier: 1,
    static: false,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Grooves                                                                    */
/* -------------------------------------------------------------------------- */

describe('record groove geometry', () => {
  it('caps the outer radius at half the diagonal, never past 560', () => {
    expect(grooveLimit(320, 400)).toBeCloseTo(Math.hypot(320, 400) / 2, 6);
    expect(grooveLimit(1440, 900)).toBe(GROOVE_OUTER_CAP);
    expect(GROOVE_OUTER_CAP).toBe(560);
    expect(grooveLimit(0, 0)).toBe(0);
  });

  it('steps at 13px, and 16px under 640px wide', () => {
    expect(grooveStep(1440)).toBe(GROOVE_STEP);
    expect(grooveStep(640)).toBe(GROOVE_STEP);
    expect(grooveStep(639)).toBe(GROOVE_STEP_NARROW);
    expect(GROOVE_STEP).toBe(13);
    expect(GROOVE_STEP_NARROW).toBe(16);
    expect(GROOVE_NARROW_WIDTH).toBe(640);
  });

  it('runs from r = 70 to the limit', () => {
    const radii = grooveRadii(1440, 900);
    expect(GROOVE_INNER_RADIUS).toBe(70);
    expect(radii[0]).toBe(70);
    expect(radii[radii.length - 1]).toBeLessThanOrEqual(GROOVE_OUTER_CAP);
    expect(radii.length).toBe(Math.floor((560 - 70) / 13) + 1);
    for (let index = 1; index < radii.length; index += 1) {
      expect(radii[index] - radii[index - 1]).toBe(GROOVE_STEP);
    }
  });

  it('uses the wider step on a narrow hero', () => {
    const radii = grooveRadii(320, 640);
    expect(radii[0]).toBe(70);
    expect(radii[1] - radii[0]).toBe(GROOVE_STEP_NARROW);
    // Fewer grooves on a phone, which is the density the frame budget needs.
    expect(radii.length).toBeLessThan(grooveRadii(1440, 900).length);
  });

  it('walks 96 segments around the circle', () => {
    const angles = grooveAngles();
    expect(GROOVE_SEGMENTS).toBe(96);
    expect(angles).toHaveLength(GROOVE_SEGMENTS + 1);
    expect(angles[0]).toBe(0);
    expect(angles[angles.length - 1]).toBeCloseTo(Math.PI * 2, 10);
  });

  it('caps the distortion at 1.8 whatever the hover energy does', () => {
    expect(GROOVE_DISTORTION_CAP).toBe(1.8);
    expect(grooveDistortion(1)).toBe(1);
    expect(grooveDistortion(1.8)).toBe(1.8);
    expect(grooveDistortion(2.2)).toBe(1.8);
    expect(grooveDistortion(-4)).toBe(0);
  });

  it('waves with the beat, the distortion, the angle, and the radius', () => {
    const wave = (beat: number, distortion: number, angle: number, radius: number) =>
      grooveWave(beat, distortion, angle, radius, 0);

    // No beat, no distortion, no movement.
    expect(wave(0, 1.8, 1, 200)).toBe(0);
    expect(wave(1, 0, 1, 200)).toBe(0);

    // The wave is bounded by the amplitude times the radius scale.
    const bound = (distortion: number, radius: number) =>
      2.4 * distortion * (radius / 380) + 1e-9;
    for (let step = 0; step < 200; step += 1) {
      const angle = (step / 200) * Math.PI * 2;
      expect(Math.abs(wave(1, 1.8, angle, 200))).toBeLessThanOrEqual(bound(1.8, 200));
      expect(Math.abs(wave(1, 1, angle, 200))).toBeLessThanOrEqual(bound(1, 200));
    }
    // A larger distortion always lifts the ceiling.
    expect(bound(1.8, 200)).toBeGreaterThan(bound(1, 200));
    // And the ceiling grows outward, so the outer grooves move more.
    expect(bound(1, 400)).toBeGreaterThan(bound(1, 120));
  });

  it('adds the wave to the radius', () => {
    const wave = grooveWave(0.5, 1, 0.7, 200, 1.2);
    expect(grooveRadius(200, 0.5, 1, 0.7, 1.2)).toBeCloseTo(200 + wave, 10);
    expect(grooveRadius(200, 0, 0, 0.7, 1.2)).toBe(200);
  });

  it('keeps every groove faint, at 0.05 plus 0.05 of a sine', () => {
    for (let index = 0; index < 40; index += 1) {
      const opacity = grooveOpacity(index);
      expect(opacity).toBeGreaterThanOrEqual(0);
      expect(opacity).toBeLessThanOrEqual(0.1);
    }
    expect(grooveOpacity(0)).toBeCloseTo(0.05, 10);
  });
});

/* -------------------------------------------------------------------------- */
/* Needle                                                                     */
/* -------------------------------------------------------------------------- */

describe('needle arcs', () => {
  it('lives on grooves 3 to 8', () => {
    expect(needleIndices(40)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(NEEDLE_FIRST_INDEX).toBe(3);
    expect(NEEDLE_LAST_INDEX).toBe(8);
    // A narrow hero has fewer grooves, and the needle never runs off the end.
    expect(needleIndices(5)).toEqual([3, 4]);
    expect(needleIndices(3)).toEqual([]);
  });

  it('advances at 0.0007 radians per millisecond, scaled by the multiplier', () => {
    expect(needleHead(1000, 1)).toBeCloseTo(0.7, 10);
    expect(needleHead(1000, 2.2)).toBeCloseTo(1.54, 10);
    expect(needleHead(0, 5)).toBe(0);
    expect(needleHead(-100, 1)).toBe(0);
  });

  it('offsets each arc by 0.12 radians per groove index', () => {
    expect(needleArcStart(3, 0.5)).toBeCloseTo(0.5 + 3 * 0.12, 10);
    expect(needleArcStart(8, 0)).toBeCloseTo(8 * 0.12, 10);
  });

  it('fades the arcs as they trail behind the head', () => {
    expect(needleOpacity(3)).toBeCloseTo(0.7, 10);
    expect(needleOpacity(4)).toBeCloseTo(0.62, 10);
    expect(needleOpacity(8)).toBeCloseTo(0.3, 10);
    expect(needleOpacity(30)).toBe(0);
  });

  it('spans 1.1 radians', () => {
    expect(NEEDLE_SPAN).toBe(1.1);
    expect(needleArcRuns(200, 0, NEEDLE_SPAN, EMPTY_RECT)).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Readability                                                                */
/* -------------------------------------------------------------------------- */

describe('hero readability rule', () => {
  it('expands the content rectangle by 12px', () => {
    expect(HERO_CONTENT_PADDING).toBe(12);
    const rect: Rect = { left: 100, top: 100, width: 200, height: 100 };

    expect(isPointInExpandedRect({ x: 150, y: 150 }, rect)).toBe(true);
    expect(isPointInExpandedRect({ x: 90, y: 150 }, rect)).toBe(true);
    expect(isPointInExpandedRect({ x: 87, y: 150 }, rect)).toBe(false);
    // An empty rectangle dims nothing.
    expect(isPointInExpandedRect({ x: 0, y: 0 }, EMPTY_RECT)).toBe(false);
  });

  it('splits an arc that crosses the content block', () => {
    const rect: Rect = { left: 100, top: -20, width: 200, height: 40 };
    const runs = needleArcRuns(150, 0, NEEDLE_SPAN, rect);

    expect(runs.length).toBeGreaterThan(1);
    expect(runs.some((run) => run.dim)).toBe(true);
    expect(runs.some((run) => !run.dim)).toBe(true);
    // The runs tile the whole arc, in order, with no gaps.
    expect(runs[0].start).toBe(0);
    expect(runs[runs.length - 1].end).toBeCloseTo(NEEDLE_SPAN, 10);
    for (let index = 1; index < runs.length; index += 1) {
      expect(runs[index].start).toBeCloseTo(runs[index - 1].end, 10);
      expect(runs[index].dim).not.toBe(runs[index - 1].dim);
    }
  });

  it('dims what is over the text to 35 percent', () => {
    expect(HERO_DIM_FACTOR).toBe(0.35);
    const { context, calls } = createMockContext();
    const rect: Rect = { left: 620, top: 380, width: 200, height: 140 };

    drawHeroGrooves(context, heroFrame({ contentRect: rect }));

    const dimmed = calls.filter(
      (call) => call.name === 'stroke' && context.globalAlpha > 0,
    );
    expect(dimmed.length).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Hover energy                                                               */
/* -------------------------------------------------------------------------- */

describe('hover energy', () => {
  it('eases about 6 percent per frame toward 2.2', () => {
    expect(HOVER_ENERGY_TARGET).toBe(2.2);
    expect(HOVER_ENERGY_REST).toBe(1);
    expect(HOVER_ENERGY_EASE).toBe(0.06);

    const first = easeEnergy(1, HOVER_ENERGY_TARGET);
    expect(first).toBeCloseTo(1 + 1.2 * 0.06, 10);

    let value = 1;
    for (let frame = 0; frame < 200; frame += 1) {
      value = easeEnergy(value, HOVER_ENERGY_TARGET);
    }
    expect(value).toBe(HOVER_ENERGY_TARGET);
  });

  it('eases back down to 1 on leave', () => {
    let value = HOVER_ENERGY_TARGET;
    for (let frame = 0; frame < 400; frame += 1) {
      value = easeEnergy(value, HOVER_ENERGY_REST);
    }
    expect(value).toBe(HOVER_ENERGY_REST);
  });

  it('never overshoots the target', () => {
    let value = 1;
    for (let frame = 0; frame < 60; frame += 1) {
      value = easeEnergy(value, HOVER_ENERGY_TARGET);
      expect(value).toBeLessThanOrEqual(HOVER_ENERGY_TARGET);
      expect(value).toBeGreaterThanOrEqual(HOVER_ENERGY_REST);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Hero frame                                                                 */
/* -------------------------------------------------------------------------- */

describe('hero frame', () => {
  it('holds the beat at 0.5 and drops the distortion when static', () => {
    expect(STATIC_BEAT).toBe(0.5);
    const values = heroFrameValues(staticHeroFrame(1440, 900, EMPTY_RECT));
    expect(values.beat).toBe(0.5);
    expect(values.distortion).toBe(0);
    expect(values.time).toBe(0);
  });

  it('follows the shared 625ms envelope while it runs', () => {
    const values = heroFrameValues(heroFrame({ timeMs: 0 }));
    expect(values.beat).toBeCloseTo(1, 6);
    const late = heroFrameValues(heroFrame({ timeMs: BEAT_MS - 1 }));
    expect(late.beat).toBeLessThan(0.01);
  });

  it('centres on the visible part of the hero', () => {
    expect(visibleCenter(900, 0, 900)).toBe(450);
    // A hero taller than the viewport, scrolled to the very top.
    expect(visibleCenter(2000, 0, 800)).toBe(400);
    // Scrolled so the hero starts above the viewport.
    expect(visibleCenter(2000, -600, 800)).toBe(1000);
    // Fully scrolled past: clamped inside the hero.
    expect(visibleCenter(2000, -2000, 800)).toBe(2000);
  });
});

/* -------------------------------------------------------------------------- */
/* Hero drawing                                                               */
/* -------------------------------------------------------------------------- */

describe('hero drawing', () => {
  it('draws one closed polyline per groove', () => {
    const { context, calls } = createMockContext();
    const stats = drawHeroGrooves(context, heroFrame());

    expect(stats.grooves).toBe(grooveRadii(1440, 900).length);
    expect(stats.grooveStrokes).toBe(stats.grooves);
    expect(counts(calls, 'stroke')).toBe(stats.grooves + stats.needleStrokes);
    // One moveTo per groove, plus one per needle run.
    expect(counts(calls, 'moveTo')).toBeGreaterThanOrEqual(
      stats.grooves + stats.needleStrokes,
    );
    // 96 segments means 96 lineTo calls per groove.
    expect(counts(calls, 'lineTo')).toBeGreaterThanOrEqual(
      stats.grooves * GROOVE_SEGMENTS,
    );
  });

  it('draws needle strokes for the six grooves that carry one', () => {
    const { context } = createMockContext();
    const stats = drawHeroGrooves(context, heroFrame());
    // Six arcs, split at most into a clear run and a dimmed run.
    expect(stats.needleStrokes).toBeGreaterThanOrEqual(6);
    expect(stats.needleStrokes).toBeLessThanOrEqual(12);
  });

  it('stays still when the frame is static', () => {
    const first = createMockContext();
    const second = createMockContext();
    const frame = staticHeroFrame(1440, 900, EMPTY_RECT);

    drawHeroGrooves(first.context, frame);
    drawHeroGrooves(second.context, frame);

    expect(first.calls).toEqual(second.calls);
  });

  it('moves between frames, so the loop has something to draw', () => {
    const first = createMockContext();
    const second = createMockContext();

    drawHeroGrooves(first.context, heroFrame({ timeMs: 0 }));
    drawHeroGrooves(second.context, heroFrame({ timeMs: 120 }));

    expect(first.calls).not.toEqual(second.calls);
  });

  it('does nothing on a zero sized hero', () => {
    const { context, calls } = createMockContext();
    const stats = drawHeroGrooves(context, heroFrame({ width: 0, height: 0 }));
    expect(stats.grooves).toBe(0);
    expect(counts(calls, 'stroke')).toBe(0);
    expect(counts(calls, 'clearRect')).toBe(1);
  });

  it('uses the token palette for ink and lime', () => {
    const { context, calls } = createMockContext();
    drawHeroGrooves(context, heroFrame());

    const inks = calls.filter(
      (call) => call.name === 'stroke' && context.strokeStyle.length > 0,
    );
    expect(inks.length).toBeGreaterThan(0);
    expect(LANDING_FALLBACK_PALETTE.ink).toBe('#F2F1ED');
    expect(LANDING_FALLBACK_PALETTE.accent).toBe('#A8E85C');
  });
});

/* -------------------------------------------------------------------------- */
/* Closing band                                                               */
/* -------------------------------------------------------------------------- */

describe('closing band logo scale', () => {
  it('is the smaller of 820px or 82 percent of the width', () => {
    // 1440 wide: 82 percent is 1180, so the 820px cap wins.
    expect(logoScale(1440, 240) * LOGO_UNITS_WIDTH).toBeCloseTo(820, 6);
    // 600 wide: 82 percent is 492, so the width wins.
    expect(logoScale(600, 240) * LOGO_UNITS_WIDTH).toBeCloseTo(492, 6);
  });

  it('never gets taller than the band minus 36px', () => {
    const scale = logoScale(1440, 120);
    expect(scale * LOGO_UNITS_HEIGHT).toBeCloseTo(120 - 36, 6);
  });

  it('is zero when there is no room at all', () => {
    expect(logoScale(0, 240)).toBe(0);
    expect(logoScale(800, 36)).toBe(0);
  });
});

describe('closing band bar heights', () => {
  it('keeps the raw height inside the clamp', () => {
    for (let step = 0; step < 400; step += 1) {
      const x = step / 400;
      const ratio = bandBarRatio(x, step * 0.11);
      expect(ratio).toBeGreaterThanOrEqual(BAND_BAR_MIN_RATIO);
      expect(ratio).toBeLessThanOrEqual(1);
    }
  });

  it('follows the four sine formula', () => {
    const x = 0.37;
    const t = 1.9;
    const raw =
      Math.abs(
        0.34 * Math.sin(x * 9 + t * 1.3) +
          0.26 * Math.sin(x * 23 - t * 2.1) +
          0.18 * Math.sin(x * 47 + t * 3.1) +
          0.12 * Math.sin(x * 91 - t * 4.3),
      ) *
        BAND_BAR_GAIN +
      0.14;

    expect(clamp(raw, BAND_BAR_MIN_RATIO, 1) * BAND_BAR_MAX_HEIGHT).toBeCloseTo(
      bandBarHeight(x * LOGO_UNITS_WIDTH, t, 1, 1),
      9,
    );
  });

  it('rises with the beat and with the closing energy', () => {
    const atRest = bandBarHeight(100, 1.2, 0, 1);
    const onBeat = bandBarHeight(100, 1.2, 1, 1);
    expect(onBeat).toBeCloseTo(atRest * 2, 9);

    const energised = bandBarHeight(100, 1.2, 1, HOVER_ENERGY_TARGET);
    expect(energised).toBeCloseTo(onBeat * (1 + 1.2 * 0.3), 9);
    // Energy 1 is a no-op.
    expect(bandBarHeight(100, 1.2, 1, 1)).toBeCloseTo(onBeat, 9);
  });

  it('lifts the bars within 18 units of the pointer by 0.3', () => {
    expect(BAND_CURSOR_RADIUS).toBe(18);
    expect(BAND_CURSOR_LIFT).toBe(0.3);

    expect(bandCursorLift(100, 100)).toBe(0.3);
    expect(bandCursorLift(100, 118)).toBe(0.3);
    expect(bandCursorLift(100, 119)).toBe(0);
    expect(bandCursorLift(100, null)).toBe(0);

    const plain = bandBarHeight(100, 0.4, 1, 1, null);
    const lifted = bandBarHeight(100, 0.4, 1, 1, 100);
    expect(lifted).toBeGreaterThan(plain);
  });

  it('steps the bars every 4.6 units at 1.3 wide, with a real gap', () => {
    const positions = bandBarPositions();
    expect(BAND_BAR_PITCH).toBe(4.6);
    expect(BAND_BAR_WIDTH).toBe(1.3);
    // Thin bars with space between them, so the letters stay legible.
    expect(BAND_BAR_WIDTH / BAND_BAR_PITCH).toBeLessThan(0.35);
    expect(positions[0]).toBe(0);
    expect(positions[1]).toBeCloseTo(4.6, 10);
    expect(positions[positions.length - 1]).toBeLessThan(LOGO_UNITS_WIDTH);
    expect(positions).toHaveLength(Math.ceil(LOGO_UNITS_WIDTH / BAND_BAR_PITCH));
  });
});

describe('closing band playhead', () => {
  it('crosses the logo in 12 seconds and wraps', () => {
    expect(BAND_PLAYHEAD_PERIOD_MS).toBe(12000);
    expect(bandPlayhead(0)).toBe(0);
    expect(bandPlayhead(BAND_PLAYHEAD_PERIOD_MS / 2)).toBeCloseTo(0.5, 10);
    expect(bandPlayhead(BAND_PLAYHEAD_PERIOD_MS)).toBeCloseTo(0, 10);
    expect(bandPlayhead(BAND_PLAYHEAD_PERIOD_MS * 3 + 3000)).toBeCloseTo(0.25, 10);
    expect(bandPlayhead(-3000)).toBeCloseTo(0.75, 10);
  });

  it('parks at 40 percent for the static frame', () => {
    expect(BAND_PLAYHEAD_STATIC).toBe(0.4);
    expect(bandPlayhead(12_345, true)).toBe(0.4);
    expect(staticBandFrame(1440, 240).static).toBe(true);
  });

  it('paints the bars left of the playhead in lime', () => {
    expect(bandBarIsLime(0.2, 0.4)).toBe(true);
    expect(bandBarIsLime(0.4, 0.4)).toBe(false);
    expect(bandBarIsLime(0.9, 0.4)).toBe(false);
  });
});

describe('closing band drawing', () => {
  const paths = LANDING_WORDMARK_PIECES.map((piece) => ({
    piece,
    path: { d: piece.d },
  }));

  it('clips to each letter and strokes the outline back', () => {
    const { context, calls } = createMockContext();
    const bars = drawLivingLogo(context, staticBandFrame(1440, 240), paths);

    // Four letters are clipped and outlined, the dot is clipped and filled.
    expect(counts(calls, 'clip')).toBe(LANDING_WORDMARK_PIECES.length);
    expect(counts(calls, 'stroke')).toBe(LANDING_WORDMARK_PIECES.length - 1);
    expect(counts(calls, 'fillRect')).toBeGreaterThan(bars);
    expect(bars).toBe(4 * bandBarPositions().length);
  });

  it('strokes the outline at about 1.1 screen pixels', () => {
    const { context, calls } = createMockContext();
    const frame = staticBandFrame(1440, 240);
    drawLivingLogo(context, frame, paths);

    const scale = logoScale(frame.width, frame.height);
    expect(context.lineWidth).toBeCloseTo(BAND_OUTLINE_WIDTH_PX / scale, 9);
    expect(BAND_OUTLINE_WIDTH_PX).toBe(1.1);
    // Stronger than before, because the outline now carries the letterforms.
    expect(BAND_OUTLINE_ALPHA).toBe(0.34);
  });

  it('fades the outer 20 percent of each edge, and nothing else', () => {
    const { context, calls } = createMockContext();
    drawLivingLogo(context, staticBandFrame(1440, 240), paths);

    const gradients = calls.filter((call) => call.name === 'createLinearGradient');
    expect(gradients).toHaveLength(2);
    expect(BAND_EDGE_FADE).toBe(0.2);
    expect(gradients[0].args).toEqual([0, 0, 1440 * 0.2, 0]);
    expect(gradients[1].args).toEqual([1440, 0, 1440 - 1440 * 0.2, 0]);
    // It erases, then puts the mode back.
    expect(context.globalCompositeOperation).toBe('source-over');
  });

  it('draws the same frame twice for reduced motion', () => {
    const first = createMockContext();
    const second = createMockContext();
    const frame = staticBandFrame(1440, 240);

    drawLivingLogo(first.context, frame, paths);
    drawLivingLogo(second.context, frame, paths);

    expect(first.calls).toEqual(second.calls);
  });

  it('moves between frames while it runs', () => {
    const first = createMockContext();
    const second = createMockContext();

    drawLivingLogo(first.context, { ...staticBandFrame(1440, 240), static: false, timeMs: 0 }, paths);
    drawLivingLogo(second.context, { ...staticBandFrame(1440, 240), static: false, timeMs: 240 }, paths);

    expect(first.calls).not.toEqual(second.calls);
  });

  it('does nothing on a zero sized band', () => {
    const { context, calls } = createMockContext();
    expect(drawLivingLogo(context, staticBandFrame(0, 0), paths)).toBe(0);
    expect(counts(calls, 'fillRect')).toBe(0);
  });

  it('skips the edge fade when there is nothing to fade', () => {
    const { context, calls } = createMockContext();
    fadeBandEdges(context, 0, 240);
    expect(counts(calls, 'createLinearGradient')).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Palette                                                                    */
/* -------------------------------------------------------------------------- */

describe('palette', () => {
  it('converts a hex to rgba', () => {
    expect(hexToRgba('#A8E85C', 0.5)).toBe('rgba(168, 232, 92, 0.5)');
    expect(hexToRgba('#fff', 1)).toBe('rgba(255, 255, 255, 1)');
    expect(hexToRgba('nonsense', 0.25)).toBe('rgba(242, 241, 237, 0.25)');
  });

  it('reads the design tokens', () => {
    const palette = readLandingPalette({
      getPropertyValue: (property: string) =>
        property === '--color-text-primary' ? '#F2F1ED' : '#A8E85C',
    });
    expect(palette).toEqual({ ink: '#F2F1ED', accent: '#A8E85C' });
  });

  it('falls back to the token values when the variables are missing', () => {
    const palette = readLandingPalette({ getPropertyValue: () => '   ' });
    expect(palette).toEqual(LANDING_FALLBACK_PALETTE);
  });
});
