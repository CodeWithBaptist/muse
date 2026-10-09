/**
 * Pure drawing math for the two landing canvases.
 *
 * The hero record grooves and the closing band living logo are the only places
 * in the product that draw per frame. Every number that places a groove, bends
 * it, sweeps the needle, dims it behind the text, sizes a logo bar, moves the
 * playhead, or eases the hover energy lives here, so all of it can be unit
 * tested without a canvas or a browser.
 *
 * Nothing in here touches the DOM. Colours are read from the design tokens by
 * the canvas components; the fallbacks below are the token values themselves.
 */

import { colors } from '@/lib/design-tokens';
import { beatEnvelope } from '@/lib/beat-clock';
import {
  LANDING_WORDMARK_BASELINE,
  LANDING_WORDMARK_HEIGHT,
  LANDING_WORDMARK_WIDTH,
  type LandingWordmarkPiece,
} from '@/lib/landing-wordmark';

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/* -------------------------------------------------------------------------- */
/* Hero: record grooves                                                       */
/* -------------------------------------------------------------------------- */

export const GROOVE_INNER_RADIUS = 70;
export const GROOVE_OUTER_CAP = 560;
export const GROOVE_STEP = 13;
export const GROOVE_STEP_NARROW = 16;
export const GROOVE_NARROW_WIDTH = 640;
export const GROOVE_SEGMENTS = 96;

/** Amplitude of the travelling wave, in radius units at the beat peak. */
export const GROOVE_WAVE_AMPLITUDE = 2.4;
/** Divisor that keeps the wave from tearing the outer grooves apart. */
export const GROOVE_RADIUS_SCALE = 380;
export const GROOVE_OPACITY_BASE = 0.05;
export const GROOVE_OPACITY_WAVE = 0.05;
export const GROOVE_STROKE_WIDTH = 1;

/** The needle only lives on these groove indices. */
export const NEEDLE_FIRST_INDEX = 3;
export const NEEDLE_LAST_INDEX = 8;
export const NEEDLE_INDEX_OFFSET = 0.12;
export const NEEDLE_SPAN = 1.1;
export const NEEDLE_WIDTH = 2;
export const NEEDLE_OPACITY_BASE = 0.7;
export const NEEDLE_OPACITY_STEP = 0.08;
/** Radians per millisecond at a multiplier of 1. */
export const NEEDLE_SPEED = 0.0007;
/** Sub segments used when splitting the needle arc for the readability rule. */
export const NEEDLE_ARC_SAMPLES = 24;

/** The content block is expanded by this much before accent is dimmed. */
export const HERO_CONTENT_PADDING = 12;
/** The accent that lands over the text is drawn at this fraction of its opacity. */
export const HERO_DIM_FACTOR = 0.35;

/** Hover energy caps out here, and the distortion it feeds is capped lower. */
export const HOVER_ENERGY_TARGET = 2.2;
export const HOVER_ENERGY_REST = 1;
/** About 6 percent of the remaining distance per frame. */
export const HOVER_ENERGY_EASE = 0.06;
export const GROOVE_DISTORTION_CAP = 1.8;

/** Beat held for the single reduced motion frame. */
export const STATIC_BEAT = 0.5;
/** Needle head held for the single reduced motion frame. */
export const STATIC_NEEDLE_HEAD = 2.1;

/** Outer groove radius for a hero of this size. */
export function grooveLimit(width: number, height: number): number {
  return Math.min(
    Math.hypot(Math.max(0, width), Math.max(0, height)) / 2,
    GROOVE_OUTER_CAP,
  );
}

/** Grooves step more widely on narrow screens. */
export function grooveStep(width: number): number {
  return width > 0 && width < GROOVE_NARROW_WIDTH
    ? GROOVE_STEP_NARROW
    : GROOVE_STEP;
}

/** The groove radii, from the inner radius to the hero limit. */
export function grooveRadii(width: number, height: number): number[] {
  const limit = grooveLimit(width, height);
  const step = grooveStep(width);
  const radii: number[] = [];
  for (
    let radius = GROOVE_INNER_RADIUS;
    radius <= limit + 1e-6;
    radius += step
  ) {
    radii.push(radius);
  }
  return radii;
}

/** The distortion the hover energy feeds into the wave. */
export function grooveDistortion(multiplier: number): number {
  return Math.min(Math.max(0, multiplier), GROOVE_DISTORTION_CAP);
}

/**
 * The travelling wave added to one groove radius at one angle.
 *
 * `beat` is the shared envelope, `distortion` the capped hover multiplier,
 * `angle` the point angle, `radius` the groove radius, and `time` seconds.
 */
export function grooveWave(
  beat: number,
  distortion: number,
  angle: number,
  radius: number,
  time: number,
): number {
  return (
    beat *
    GROOVE_WAVE_AMPLITUDE *
    distortion *
    Math.sin(angle * 6 + radius * 0.04 - time * 3) *
    (radius / GROOVE_RADIUS_SCALE)
  );
}

/** The radius of a groove at one angle. */
export function grooveRadius(
  radius: number,
  beat: number,
  distortion: number,
  angle: number,
  time: number,
): number {
  return radius + grooveWave(beat, distortion, angle, radius, time);
}

/** Groove stroke opacity: faint, and faintly varied from groove to groove. */
export function grooveOpacity(index: number): number {
  return GROOVE_OPACITY_BASE + GROOVE_OPACITY_WAVE * Math.sin(index * 0.9);
}

/** One point on a groove, relative to the hero centre. */
export function groovePoint(radius: number, angle: number): Point {
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

/** The angles walked when a groove is drawn as a polyline. */
export function grooveAngles(segments: number = GROOVE_SEGMENTS): number[] {
  const angles: number[] = [];
  for (let index = 0; index <= segments; index += 1) {
    angles.push((index / segments) * Math.PI * 2);
  }
  return angles;
}

/** Where the needle head sits, in radians. */
export function needleHead(timeMs: number, multiplier: number): number {
  return Math.max(0, timeMs) * NEEDLE_SPEED * Math.max(0, multiplier);
}

/** Where one needle arc starts. */
export function needleArcStart(index: number, head: number): number {
  return head + index * NEEDLE_INDEX_OFFSET;
}

/** Needle opacity for one groove index. */
export function needleOpacity(index: number): number {
  const step = index - NEEDLE_FIRST_INDEX;
  return Math.max(0, NEEDLE_OPACITY_BASE - step * NEEDLE_OPACITY_STEP);
}

/** The groove indices that carry a needle arc. */
export function needleIndices(count: number): number[] {
  const indices: number[] = [];
  const last = Math.min(NEEDLE_LAST_INDEX, count - 1);
  for (let index = NEEDLE_FIRST_INDEX; index <= last; index += 1) {
    indices.push(index);
  }
  return indices;
}

export function isPointInExpandedRect(
  point: Point,
  rect: Rect,
  padding: number = HERO_CONTENT_PADDING,
): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false;
  return (
    point.x >= rect.left - padding &&
    point.x <= rect.left + rect.width + padding &&
    point.y >= rect.top - padding &&
    point.y <= rect.top + rect.height + padding
  );
}

export interface ArcRun {
  start: number;
  end: number;
  /** True while this run sits over the content block and must be dimmed. */
  dim: boolean;
}

/**
 * Splits a needle arc into runs that are either clear of the hero content or
 * over it. Consecutive sub segments with the same reading are merged, so a full
 * arc costs at most a handful of strokes.
 */
export function needleArcRuns(
  radius: number,
  start: number,
  span: number = NEEDLE_SPAN,
  rect: Rect,
  offset: Point = { x: 0, y: 0 },
  samples: number = NEEDLE_ARC_SAMPLES,
): ArcRun[] {
  if (span <= 0 || samples <= 0) return [];

  const runs: ArcRun[] = [];
  let runStart = start;
  let runDim: boolean | null = null;

  for (let index = 0; index < samples; index += 1) {
    const angle = start + (span * (index + 0.5)) / samples;
    const point = groovePoint(radius, angle);
    const dim = isPointInExpandedRect(
      { x: point.x + offset.x, y: point.y + offset.y },
      rect,
    );

    if (runDim === null) {
      runDim = dim;
      continue;
    }

    if (dim !== runDim) {
      runs.push({
        start: runStart,
        end: start + (span * index) / samples,
        dim: runDim,
      });
      runStart = start + (span * index) / samples;
      runDim = dim;
    }
  }

  if (runDim !== null) {
    runs.push({ start: runStart, end: start + span, dim: runDim });
  }

  return runs;
}

/**
 * Eases the hover energy toward its target, about 6 percent of the remaining
 * distance per frame, and snaps when it is close enough that the difference is
 * invisible.
 */
export function easeEnergy(
  current: number,
  target: number,
  factor: number = HOVER_ENERGY_EASE,
): number {
  const next = current + (target - current) * factor;
  return Math.abs(target - next) < 0.0005 ? target : next;
}

/** One hero frame, ready for the drawing function. */
export interface HeroFrame {
  width: number;
  height: number;
  /** Hero centre, which is also the centre of the visible hero. */
  cx: number;
  cy: number;
  /** The content block, in canvas coordinates. */
  contentRect: Rect;
  timeMs: number;
  multiplier: number;
  /** True for the single reduced motion frame. */
  static: boolean;
}

/**
 * The centre of the part of the hero that is actually on screen, so the record
 * stays centred even when the hero is taller than the viewport.
 */
export function visibleCenter(
  height: number,
  rectTop: number,
  viewportHeight: number,
): number {
  const top = clamp(-rectTop, 0, Math.max(0, height));
  const bottom = clamp(
    -rectTop + Math.max(0, viewportHeight),
    0,
    Math.max(0, height),
  );
  return (top + bottom) / 2;
}

/** The one deterministic pose used when motion is reduced. */
export function staticHeroFrame(
  width: number,
  height: number,
  contentRect: Rect,
): HeroFrame {
  return {
    width,
    height,
    cx: width / 2,
    cy: height / 2,
    contentRect,
    timeMs: STATIC_NEEDLE_HEAD / NEEDLE_SPEED,
    multiplier: 1,
    static: true,
  };
}

/** The beat and distortion for one hero frame. */
export function heroFrameValues(frame: HeroFrame): {
  beat: number;
  distortion: number;
  time: number;
} {
  return {
    beat: frame.static ? STATIC_BEAT : beatEnvelope(frame.timeMs),
    distortion: frame.static ? 0 : grooveDistortion(frame.multiplier),
    time: frame.static ? 0 : frame.timeMs / 1000,
  };
}

export interface GrooveCanvasContext {
  globalAlpha: number;
  lineWidth: number;
  lineCap: string;
  strokeStyle: string;
  fillStyle: string | CanvasGradientLike;
  globalCompositeOperation: string;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, start: number, end: number): void;
  stroke(): void;
  fill(): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  clearRect(x: number, y: number, width: number, height: number): void;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  clip(path: unknown): void;
  stroke(path: unknown): void;
  setTransform(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ): void;
  createLinearGradient(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): CanvasGradientLike;
}

export interface CanvasGradientLike {
  addColorStop(offset: number, colour: string): void;
}

/* -------------------------------------------------------------------------- */
/* Closing band: living logo                                                  */
/* -------------------------------------------------------------------------- */

export const BAND_HEIGHT = 240;
export const BAND_MAX_LOGO_WIDTH = 820;
export const BAND_LOGO_WIDTH_FRACTION = 0.82;
/** The logo never gets closer than this to the top or the bottom of the band. */
export const BAND_LOGO_VERTICAL_MARGIN = 36;

/** The wordmark, in font units, taken from the shared landing path data. */
export const LOGO_UNITS_WIDTH = LANDING_WORDMARK_WIDTH;
export const LOGO_UNITS_HEIGHT = LANDING_WORDMARK_HEIGHT;
/** The baseline the bars rise from, in the same units. */
export const LOGO_BASELINE = LANDING_WORDMARK_BASELINE;

/**
 * The bars are thin and well spaced, so the letters read as letters. At the old
 * 2.3 in 3.2 pitch the bars nearly touched and the wordmark read as a solid
 * block with a fuzzy top edge.
 */
export const BAND_BAR_PITCH = 4.6;
export const BAND_BAR_WIDTH = 1.3;
/** Bars peak at roughly 70 percent of the 54 unit letter height. */
export const BAND_BAR_MAX_HEIGHT = 38;
export const BAND_BAR_MIN_RATIO = 0.12;
export const BAND_BAR_MAX_RATIO = 1;
/**
 * Gain on the four sine waves. Their amplitudes sum to 0.9, so the old 1.6
 * drove the clamp and most bars sat pinned at full height. At 0.95 the tallest
 * bar reaches 0.995 and the shape breathes instead of saturating.
 */
export const BAND_BAR_GAIN = 0.95;

/** One sweep of the playhead across the logo. */
export const BAND_PLAYHEAD_PERIOD_MS = 12000;
export const BAND_PLAYHEAD_STATIC = 0.4;

/** The pointer lifts the bars within this many logo units. */
export const BAND_CURSOR_RADIUS = 18;
export const BAND_CURSOR_LIFT = 0.3;

/** Bar alphas, and the outline that keeps the shapes readable. */
export const BAND_BAR_ACCENT_ALPHA = 0.7;
export const BAND_BAR_INK_ALPHA = 0.42;
export const BAND_OUTLINE_ALPHA = 0.34;
export const BAND_OUTLINE_WIDTH_PX = 1.1;

/** Plain edge fade, as a fraction of the band width on each side. */
export const BAND_EDGE_FADE = 0.2;

/**
 * The scale that fits the logo into the band: the smaller of 820px or 82 percent
 * of the width, and never taller than the band minus its vertical margin.
 */
export function logoScale(width: number, height: number): number {
  const usableWidth = Math.min(
    BAND_MAX_LOGO_WIDTH,
    Math.max(0, width) * BAND_LOGO_WIDTH_FRACTION,
  );
  const usableHeight = Math.max(0, height) - BAND_LOGO_VERTICAL_MARGIN;
  const scale = Math.min(
    usableWidth / LOGO_UNITS_WIDTH,
    usableHeight / LOGO_UNITS_HEIGHT,
  );
  return Math.max(0, scale);
}

/**
 * The raw bar height at one normalised position along the logo. Four sines at
 * unrelated rates keep the surface from reading as a repeated pattern.
 */
export function bandBarRaw(x: number, time: number): number {
  return (
    Math.abs(
      0.34 * Math.sin(x * 9 + time * 1.3) +
        0.26 * Math.sin(x * 23 - time * 2.1) +
        0.18 * Math.sin(x * 47 + time * 3.1) +
        0.12 * Math.sin(x * 91 - time * 4.3),
    ) *
      BAND_BAR_GAIN +
    0.14
  );
}

/** The clamped bar ratio, from 0.12 to 1. */
export function bandBarRatio(x: number, time: number): number {
  return clamp(bandBarRaw(x, time), BAND_BAR_MIN_RATIO, BAND_BAR_MAX_RATIO);
}

/** How much the pointer lifts one bar. Touch has no pointer, so it gets none. */
export function bandCursorLift(barX: number, cursorX: number | null): number {
  if (cursorX === null) return 0;
  return Math.abs(barX - cursorX) <= BAND_CURSOR_RADIUS ? BAND_CURSOR_LIFT : 0;
}

/**
 * The height of one bar, in logo units. `xUnits` is the bar position along the
 * logo in logo units, and it is normalised here before it reaches the wave. The
 * clamped ratio is scaled by the beat and by the closing energy, then lifted by
 * the pointer when it is near.
 */
export function bandBarHeight(
  xUnits: number,
  time: number,
  beat: number,
  energy: number,
  cursorX: number | null = null,
): number {
  const normalized = clamp(xUnits / LOGO_UNITS_WIDTH, 0, 1);
  const lifted =
    bandBarRatio(normalized, time) + bandCursorLift(xUnits, cursorX);
  return (
    lifted * BAND_BAR_MAX_HEIGHT * (0.5 + 0.5 * beat) * (1 + (energy - 1) * 0.3)
  );
}

/** The playhead position along the logo, from 0 to 1. */
export function bandPlayhead(timeMs: number, isStatic = false): number {
  if (isStatic) return BAND_PLAYHEAD_STATIC;
  const period = Math.max(1, BAND_PLAYHEAD_PERIOD_MS);
  const wrapped = ((timeMs % period) + period) % period;
  return wrapped / period;
}

/** The bar positions along the logo, in logo units. */
export function bandBarPositions(): number[] {
  const positions: number[] = [];
  for (let x = 0; x < LOGO_UNITS_WIDTH; x += BAND_BAR_PITCH) {
    positions.push(x);
  }
  return positions;
}

/** True when a bar sits behind the playhead and is drawn in accent. */
export function bandBarIsAccent(
  normalizedX: number,
  playhead: number,
): boolean {
  return normalizedX < playhead;
}

/** One closing band frame. */
export interface BandFrame {
  width: number;
  height: number;
  timeMs: number;
  energy: number;
  /** Pointer position along the logo, in logo units, or null on touch. */
  cursorX: number | null;
  static: boolean;
}

/** The one deterministic pose used when motion is reduced. */
export function staticBandFrame(width: number, height: number): BandFrame {
  return {
    width,
    height,
    timeMs: 0,
    energy: 1,
    cursorX: null,
    static: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Palette                                                                    */
/* -------------------------------------------------------------------------- */

export interface LandingPalette {
  ink: string;
  accent: string;
}

/** The design tokens, used only as a fallback when the variables are absent. */
export const LANDING_FALLBACK_PALETTE: LandingPalette = {
  ink: colors.textPrimary,
  accent: colors.accent,
};

export function hexToRgba(hex: string, alpha: number): string {
  const value = hex.trim().replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((character) => character + character)
          .join('')
      : value;

  const int = Number.parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(int)) {
    return `rgba(242, 241, 237, ${alpha})`;
  }

  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
}

/**
 * Reads the design tokens so neither canvas hardcodes a similar looking colour.
 */
export function readLandingPalette(styles: {
  getPropertyValue: (property: string) => string;
}): LandingPalette {
  const read = (property: string, fallback: string) => {
    const value = styles.getPropertyValue(property).trim();
    return value.length > 0 ? value : fallback;
  };

  return {
    ink: read('--color-text-primary', LANDING_FALLBACK_PALETTE.ink),
    accent: read('--color-accent', LANDING_FALLBACK_PALETTE.accent),
  };
}

/* -------------------------------------------------------------------------- */
/* Drawing                                                                    */
/* -------------------------------------------------------------------------- */

export interface HeroDrawStats {
  grooves: number;
  /** One stroke per groove, plus the needle runs. */
  grooveStrokes: number;
  needleStrokes: number;
}

/**
 * Draws one hero frame: the grooves first, then the accent needle on top of the
 * six grooves it lives on. The accent over the hero content block is drawn at a
 * fraction of its opacity, so the text and the buttons stay easy to read.
 */
export function drawHeroGrooves(
  ctx: GrooveCanvasContext,
  frame: HeroFrame,
  palette: LandingPalette = LANDING_FALLBACK_PALETTE,
): HeroDrawStats {
  const { width, height } = frame;
  ctx.clearRect(0, 0, Math.max(0, width), Math.max(0, height));
  if (width <= 0 || height <= 0) {
    return { grooves: 0, grooveStrokes: 0, needleStrokes: 0 };
  }

  const radii = grooveRadii(width, height);
  if (radii.length === 0) {
    return { grooves: 0, grooveStrokes: 0, needleStrokes: 0 };
  }

  const { beat, distortion, time } = heroFrameValues(frame);
  const angles = grooveAngles();
  const pointAt = (radius: number, angle: number): Point => {
    const rr = grooveRadius(radius, beat, distortion, angle, time);
    return {
      x: frame.cx + Math.cos(angle) * rr,
      y: frame.cy + Math.sin(angle) * rr,
    };
  };

  ctx.lineCap = 'round';
  ctx.lineWidth = GROOVE_STROKE_WIDTH;
  ctx.strokeStyle = hexToRgba(palette.ink, 1);

  let grooveStrokes = 0;
  for (let index = 0; index < radii.length; index += 1) {
    const radius = radii[index];
    ctx.globalAlpha = clamp(grooveOpacity(index), 0, 1);
    ctx.beginPath();
    for (let step = 0; step < angles.length; step += 1) {
      const point = pointAt(radius, angles[step]);
      if (step === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    grooveStrokes += 1;
  }

  const head = frame.static
    ? STATIC_NEEDLE_HEAD
    : needleHead(frame.timeMs, frame.multiplier);

  ctx.lineWidth = NEEDLE_WIDTH;
  ctx.strokeStyle = hexToRgba(palette.accent, 1);

  let needleStrokes = 0;
  for (const index of needleIndices(radii.length)) {
    const radius = radii[index];
    const base = needleOpacity(index);
    const runs = needleArcRuns(
      radius,
      needleArcStart(index, head),
      NEEDLE_SPAN,
      frame.contentRect,
      {
        x: frame.cx,
        y: frame.cy,
      },
    );

    for (const dim of [false, true]) {
      const parts = runs.filter((run) => run.dim === dim);
      if (parts.length === 0) continue;

      ctx.globalAlpha = clamp(base * (dim ? HERO_DIM_FACTOR : 1), 0, 1);
      ctx.beginPath();
      for (const run of parts) {
        const steps = Math.max(
          2,
          Math.round(
            (run.end - run.start) / (NEEDLE_SPAN / NEEDLE_ARC_SAMPLES),
          ),
        );
        for (let step = 0; step <= steps; step += 1) {
          const angle = run.start + ((run.end - run.start) * step) / steps;
          const point = pointAt(radius, angle);
          if (step === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        }
      }
      ctx.stroke();
      needleStrokes += 1;
    }
  }

  ctx.globalAlpha = 1;
  return { grooves: radii.length, grooveStrokes, needleStrokes };
}

export interface LogoPath {
  piece: LandingWordmarkPiece;
  /** A Path2D built from the piece path data. */
  path: unknown;
}

/**
 * Draws one closing band frame: the wordmark as vertical bars clipped to each
 * letter, with the playhead turning the bars it has passed into accent, an
 * outline that keeps the shapes readable when the bars are low, a solid accent
 * dot, and a plain edge fade at both sides.
 *
 * `makePath` builds a Path2D from the path data. It is passed in so the drawing
 * can be unit tested without a browser.
 */
export function drawLivingLogo(
  ctx: GrooveCanvasContext,
  frame: BandFrame,
  paths: readonly LogoPath[],
  palette: LandingPalette = LANDING_FALLBACK_PALETTE,
): number {
  const { width, height } = frame;
  ctx.clearRect(0, 0, Math.max(0, width), Math.max(0, height));
  if (width <= 0 || height <= 0) return 0;

  const scale = logoScale(width, height);
  if (scale <= 0 || paths.length === 0) return 0;

  const beat = frame.static ? STATIC_BEAT : beatEnvelope(frame.timeMs);
  const time = frame.static ? 0 : frame.timeMs / 1000;
  const playhead = bandPlayhead(frame.timeMs, frame.static);
  const originX = width / 2 - (LOGO_UNITS_WIDTH * scale) / 2;
  const baselineY = height / 2 + (LOGO_UNITS_HEIGHT * scale) / 2;
  const positions = bandBarPositions();

  let bars = 0;

  for (const { piece, path } of paths) {
    ctx.save();
    ctx.translate(originX, baselineY);
    ctx.scale(scale, scale);

    if (piece.tone === 'accent') {
      // The dot is solid accent, so it reads at any bar height.
      ctx.fillStyle = hexToRgba(palette.accent, BAND_BAR_ACCENT_ALPHA);
      ctx.clip(path);
      ctx.fillRect(
        0,
        -LOGO_UNITS_HEIGHT,
        LOGO_UNITS_WIDTH,
        LOGO_UNITS_HEIGHT * 2,
      );
      ctx.restore();
      continue;
    }

    ctx.clip(path);

    const accent: Array<[number, number]> = [];
    const ink: Array<[number, number]> = [];
    for (const x of positions) {
      const bucket = bandBarIsAccent(x / LOGO_UNITS_WIDTH, playhead)
        ? accent
        : ink;
      bucket.push([
        x,
        bandBarHeight(x, time, beat, frame.energy, frame.cursorX),
      ]);
      bars += 1;
    }

    ctx.fillStyle = hexToRgba(palette.accent, BAND_BAR_ACCENT_ALPHA);
    for (const [x, h] of accent) ctx.fillRect(x, -h, BAND_BAR_WIDTH, h);

    ctx.fillStyle = hexToRgba(palette.ink, BAND_BAR_INK_ALPHA);
    for (const [x, h] of ink) ctx.fillRect(x, -h, BAND_BAR_WIDTH, h);

    ctx.restore();

    // The outline keeps the letterforms readable when the bars are low.
    ctx.save();
    ctx.translate(originX, baselineY);
    ctx.scale(scale, scale);
    ctx.lineWidth = BAND_OUTLINE_WIDTH_PX / scale;
    ctx.strokeStyle = hexToRgba(palette.ink, BAND_OUTLINE_ALPHA);
    ctx.stroke(path);
    ctx.restore();
  }

  fadeBandEdges(ctx, width, height);
  return bars;
}

/**
 * The plain edge fade. It is the only gradient on the page: two horizontal
 * ramps, one at each side, that erase the outer fifth of the band.
 */
export function fadeBandEdges(
  ctx: GrooveCanvasContext,
  width: number,
  height: number,
): void {
  const fade = Math.max(0, width) * BAND_EDGE_FADE;
  if (fade <= 0 || width <= 0 || height <= 0) return;

  ctx.globalCompositeOperation = 'destination-out';

  const left = ctx.createLinearGradient(0, 0, fade, 0);
  left.addColorStop(0, 'rgba(0, 0, 0, 1)');
  left.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, fade, height);

  const right = ctx.createLinearGradient(width, 0, width - fade, 0);
  right.addColorStop(0, 'rgba(0, 0, 0, 1)');
  right.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = right;
  ctx.fillRect(width - fade, 0, fade, height);

  ctx.globalCompositeOperation = 'source-over';
}
