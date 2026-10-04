/**
 * Radial spectrum hero geometry.
 *
 * The hero background is a ring of flat bars around the hero content. Every
 * number that places a bar, sizes it, colours it, hides it behind the text, or
 * clamps it inside the hero is computed here, so the whole drawing can be unit
 * tested without a canvas or a browser.
 *
 * The canvas is the only place in the site that draws per frame. The rules the
 * geometry has to keep:
 * - bars are horizontal strokes that never overlap the hero content,
 * - every bar stays inside the hero with a margin,
 * - the trail keeps lime well under a few percent of the screen,
 * - reduced motion gets one static frame, never a loop.
 */

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

export interface RadialRing {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface RadialBar {
  index: number;
  /** Ellipse angle, in radians. */
  angle: number;
  start: Point;
  end: Point;
  length: number;
  /** True when the bar is inside the sweep behind the trail head. */
  lime: boolean;
  opacity: number;
}

export interface RadialPalette {
  ink: string;
  accent: string;
}

export const SPECTRUM_FALLBACK_PALETTE: RadialPalette = {
  ink: '#F2F1ED',
  accent: '#A8E85C',
};

/** Bar count, and the width below which the small layout is used. */
export const SPECTRUM_BARS_WIDE = 120;
export const SPECTRUM_BARS_NARROW = 72;
export const SPECTRUM_NARROW_WIDTH = 640;

/** Quality steps used when frames keep running long. Never shown as a jump up. */
export const SPECTRUM_QUALITY_STEPS = [1, 0.8, 0.6] as const;
export const SPECTRUM_FRAME_PRESSURE_MS = 19.5;

export const SPECTRUM_STROKE_WIDTH = 3;
/** Room kept between the content box and the ring. */
export const SPECTRUM_RING_PADDING = 40;
/** The ring never shrinks below this fraction of the hero's short side. */
export const SPECTRUM_RING_MIN_FRACTION = 0.25;
/** Bars whose midpoint lands inside the content box plus this are skipped. */
export const SPECTRUM_CONTENT_PADDING = 16;
/** Every bar keeps this much room inside the hero edges. */
export const SPECTRUM_EDGE_MARGIN = 6;
/** Bars shorter than this are not drawn at all. */
export const SPECTRUM_MIN_BAR_LENGTH = 4;

/** One shared clock at 96 BPM. */
export const SPECTRUM_BPM = 96;
export const SPECTRUM_BEAT_MS = 60_000 / SPECTRUM_BPM;
export const SPECTRUM_BEAT_DECAY = 5.5;

/** Radians per second. */
export const SPECTRUM_ROTATION_SPEED = 0.1;
export const SPECTRUM_TRAIL_HEAD_SPEED = 0.5;
/** Sweep behind the trail head that is drawn in lime. */
export const SPECTRUM_TRAIL_LENGTH = 1.5;

export const SPECTRUM_LENGTH_MIN = 0.3;
export const SPECTRUM_LENGTH_RANGE = 0.7;
export const SPECTRUM_BEAT_FLOOR = 0.45;
export const SPECTRUM_BEAT_RANGE = 0.55;
export const SPECTRUM_LENGTH_SCALE = 0.13;
export const SPECTRUM_LENGTH_BASE = 6;
export const SPECTRUM_HOVER_AMPLITUDE = 1.8;
/** About 6 percent per frame toward the hover target. */
export const SPECTRUM_AMPLITUDE_EASE = 0.06;

export const SPECTRUM_POINTER_SIGMA = 0.35;
/** Extra length, in fractions of the hero's short side, at the pointer. */
export const SPECTRUM_POINTER_STRENGTH = 0.1;

export const SPECTRUM_TRAIL_OPACITY_MAX = 0.95;
export const SPECTRUM_TRAIL_OPACITY_FLOOR = 0.12;
export const SPECTRUM_IDLE_OPACITY = 0.2;
export const SPECTRUM_OPACITY_BUCKETS = 8;

/** The intro build: starts after the headline reveal begins. */
export const SPECTRUM_INTRO_START_MS = 1000;
export const SPECTRUM_INTRO_BUILD_MS = 1200;
export const SPECTRUM_INTRO_BAR_MS = 360;

/** The pose used when motion is reduced: no rotation, no beat, fixed trail. */
export const SPECTRUM_STATIC_BEAT = 0.5;
export const SPECTRUM_STATIC_TRAIL_HEAD = 0.7;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Bar count for a hero width. Small screens get a shorter ring. */
export function barCountForWidth(width: number): number {
  return width < SPECTRUM_NARROW_WIDTH
    ? SPECTRUM_BARS_NARROW
    : SPECTRUM_BARS_WIDE;
}

/**
 * Quality adaptation for a long bar ring: frames that keep running long drop a
 * step. It only ever reduces, so the ring cannot flicker between two counts.
 * The ladder is a fraction of the layout's own bar count.
 */
export function nextBarCount(
  current: number,
  averageFrameMs: number,
  base: number = SPECTRUM_BARS_WIDE,
  steps: readonly number[] = SPECTRUM_QUALITY_STEPS,
): number {
  if (averageFrameMs <= SPECTRUM_FRAME_PRESSURE_MS) return current;

  const ladder = steps.map((step) => Math.round(base * step));
  const index = ladder.findIndex((count) => count <= current);
  if (index === -1) return Math.min(current, ladder[ladder.length - 1]);
  const next = ladder[index + 1] ?? ladder[index];
  return Math.min(next, current);
}

/**
 * The ring is an ellipse centred on the hero content, 40px outside it, and
 * never smaller than a quarter of the hero's short side.
 */
export function ringForRect(
  content: Rect,
  heroWidth: number,
  heroHeight: number,
): RadialRing {
  const cx = content.left + content.width / 2;
  const cy = content.top + content.height / 2;
  const minimum = Math.min(heroWidth, heroHeight) * SPECTRUM_RING_MIN_FRACTION;

  return {
    cx,
    cy,
    rx: Math.max(content.width / 2 + SPECTRUM_RING_PADDING, minimum),
    ry: Math.max(content.height / 2 + SPECTRUM_RING_PADDING, minimum),
  };
}

export function ellipsePoint(ring: RadialRing, angle: number): Point {
  return {
    x: ring.cx + ring.rx * Math.cos(angle),
    y: ring.cy + ring.ry * Math.sin(angle),
  };
}

/**
 * Outward normal of the ellipse at an angle, in the direction of
 * (cos / rx, sin / ry), normalized so a bar's length is a real length.
 */
export function ellipseNormal(ring: RadialRing, angle: number): Point {
  const nx = Math.cos(angle) / Math.max(ring.rx, 1e-6);
  const ny = Math.sin(angle) / Math.max(ring.ry, 1e-6);
  const magnitude = Math.hypot(nx, ny);
  if (magnitude === 0) return { x: 1, y: 0 };
  return { x: nx / magnitude, y: ny / magnitude };
}

/** Wraps an angle into [0, 2pi). */
export function wrapAngle(angle: number): number {
  const full = Math.PI * 2;
  return ((angle % full) + full) % full;
}

/** Signed difference a - b wrapped into (-pi, pi]. */
export function angleDifference(a: number, b: number): number {
  const full = Math.PI * 2;
  let difference = (a - b) % full;
  if (difference > Math.PI) difference -= full;
  if (difference <= -Math.PI) difference += full;
  return difference;
}

/** Per bar variation, in [0, 1]. Two out of phase sines, so bars never march. */
export function barVariation(index: number, timeSeconds: number): number {
  return Math.abs(
    Math.sin(index * 0.35 + timeSeconds * 1.5) * 0.6 +
      Math.sin(index * 0.11 - timeSeconds * 0.9) * 0.4,
  );
}

export interface BarLengthInput {
  variation: number;
  beat: number;
  amplitude: number;
  /** min(heroWidth, heroHeight). */
  minDimension: number;
}

export function barLength({
  variation,
  beat,
  amplitude,
  minDimension,
}: BarLengthInput): number {
  const shape =
    SPECTRUM_LENGTH_MIN + SPECTRUM_LENGTH_RANGE * clamp(variation, 0, 1);
  const pulse = SPECTRUM_BEAT_FLOOR + SPECTRUM_BEAT_RANGE * clamp(beat, 0, 1);
  return (
    shape * pulse * minDimension * SPECTRUM_LENGTH_SCALE * amplitude +
    SPECTRUM_LENGTH_BASE
  );
}

/**
 * Length added to a bar that faces the pointer: a narrow Gaussian on the
 * wrapped angle between the bar direction and the pointer direction.
 */
export function pointerPull(angleDiff: number, minDimension: number): number {
  const offset = angleDiff / SPECTRUM_POINTER_SIGMA;
  return (
    Math.exp(-(offset * offset)) * minDimension * SPECTRUM_POINTER_STRENGTH
  );
}

/**
 * Opacity for a bar that sits `behind` radians behind the trail head. Inside
 * the sweep it is lime and bright at the head, outside it stays a faint ink.
 */
export function trailOpacity(behind: number): number {
  if (behind >= SPECTRUM_TRAIL_LENGTH) return SPECTRUM_IDLE_OPACITY;
  const falloff = 1 - behind / SPECTRUM_TRAIL_LENGTH;
  return Math.min(
    1,
    SPECTRUM_TRAIL_OPACITY_MAX * falloff + SPECTRUM_TRAIL_OPACITY_FLOOR,
  );
}

export function isTrailBar(behind: number): boolean {
  return behind < SPECTRUM_TRAIL_LENGTH;
}

/**
 * Text safety rule: a bar whose midpoint lands inside the content box, expanded
 * by 16px, is not drawn at all.
 */
export function pointInExpandedRect(
  point: Point,
  rect: Rect,
  padding: number = SPECTRUM_CONTENT_PADDING,
): boolean {
  return (
    point.x >= rect.left - padding &&
    point.x <= rect.left + rect.width + padding &&
    point.y >= rect.top - padding &&
    point.y <= rect.top + rect.height + padding
  );
}

export interface ClampedBar {
  end: Point;
  /** Length of the clamped segment, in pixels. */
  length: number;
}

/**
 * Shortens a bar so its outer end stays inside the hero with a margin. Returns
 * a zero length bar when there is no room, which the caller skips.
 */
export function clampBarToHero(
  start: Point,
  end: Point,
  heroWidth: number,
  heroHeight: number,
  margin: number = SPECTRUM_EDGE_MARGIN,
): ClampedBar {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  let scale = 1;
  const limitX = (target: number) => {
    if (Math.abs(dx) < 1e-6) return;
    scale = Math.min(scale, (target - start.x) / dx);
  };
  const limitY = (target: number) => {
    if (Math.abs(dy) < 1e-6) return;
    scale = Math.min(scale, (target - start.y) / dy);
  };

  if (dx > 0) limitX(heroWidth - margin);
  if (dx < 0) limitX(margin);
  if (dy > 0) limitY(heroHeight - margin);
  if (dy < 0) limitY(margin);

  scale = clamp(scale, 0, 1);
  const length = Math.hypot(dx, dy) * scale;

  return {
    end: { x: start.x + dx * scale, y: start.y + dy * scale },
    length,
  };
}

/**
 * Intro build: each bar eases from 0 to 1, staggered by index so the ring fills
 * in clockwise. `elapsedMs` is measured from the first painted frame.
 */
export function introProgress(
  index: number,
  count: number,
  elapsedMs: number,
): number {
  const staggerWindow = SPECTRUM_INTRO_BUILD_MS - SPECTRUM_INTRO_BAR_MS;
  const stagger =
    count <= 1 ? 0 : clamp(index / count, 0, 1) * staggerWindow;
  const progress = (elapsedMs - SPECTRUM_INTRO_START_MS - stagger) /
    SPECTRUM_INTRO_BAR_MS;

  if (progress <= 0) return 0;
  if (progress >= 1) return 1;

  // Cubic ease out, so a bar snaps out of the ring instead of growing linearly.
  const inverted = 1 - progress;
  return 1 - inverted * inverted * inverted;
}

const TWO_PI = Math.PI * 2;

/** Phase within the current beat, 0 to 1. */
export function beatPhase(timeMs: number): number {
  const wrapped = ((timeMs % SPECTRUM_BEAT_MS) + SPECTRUM_BEAT_MS) %
    SPECTRUM_BEAT_MS;
  return wrapped / SPECTRUM_BEAT_MS;
}

/** The beat envelope: 1 on the beat, decaying by the end of it. */
export function beatEnvelope(timeMs: number): number {
  return Math.exp(-beatPhase(timeMs) * SPECTRUM_BEAT_DECAY);
}

/** Eases the hover amplitude toward its target. */
export function easeAmplitude(
  current: number,
  target: number,
  factor: number = SPECTRUM_AMPLITUDE_EASE,
): number {
  const next = current + (target - current) * factor;
  return Math.abs(target - next) < 0.001 ? target : next;
}

/** Rounds an opacity into a small number of stroke buckets. */
export function quantizeOpacity(
  opacity: number,
  buckets: number = SPECTRUM_OPACITY_BUCKETS,
): number {
  const clamped = clamp(opacity, 0, 1);
  return clamp(Math.round(clamped * buckets) / buckets, 0, 1);
}

export interface RadialFrame {
  width: number;
  height: number;
  ring: RadialRing;
  /** Hero content box, in canvas coordinates. */
  contentRect: Rect;
  /** Milliseconds since the spectrum first painted. */
  timeMs: number;
  /** 1 at rest, eased toward SPECTRUM_HOVER_AMPLITUDE on hover or focus. */
  amplitude: number;
  barCount: number;
  /** Angle from the ring centre to the pointer, or null when it is away. */
  pointerAngle: number | null;
  /** Reduced motion: one deterministic pose, no rotation, no pointer pull. */
  static: boolean;
}

/**
 * Builds every visible bar for a frame. Bars that would sit over the content,
 * or that have no room left inside the hero, are dropped.
 */
export function buildBars(frame: RadialFrame): RadialBar[] {
  const { ring, contentRect, width, height, barCount, static: isStatic } = frame;
  if (width <= 0 || height <= 0 || barCount <= 0) return [];

  const timeSeconds = isStatic ? 0 : frame.timeMs / 1000;
  const beat = isStatic ? SPECTRUM_STATIC_BEAT : beatEnvelope(frame.timeMs);
  const rotation = isStatic ? 0 : timeSeconds * SPECTRUM_ROTATION_SPEED;
  const trailHead = isStatic
    ? SPECTRUM_STATIC_TRAIL_HEAD
    : timeSeconds * SPECTRUM_TRAIL_HEAD_SPEED;
  const minDimension = Math.min(width, height);
  const amplitude = isStatic ? 1 : frame.amplitude;
  const bars: RadialBar[] = [];

  for (let index = 0; index < barCount; index += 1) {
    const angle = (index / barCount) * TWO_PI + rotation;
    const start = ellipsePoint(ring, angle);
    const normal = ellipseNormal(ring, angle);

    let length = barLength({
      variation: barVariation(index, timeSeconds),
      beat,
      amplitude,
      minDimension,
    });

    if (!isStatic && frame.pointerAngle !== null) {
      const direction = Math.atan2(normal.y, normal.x);
      length += pointerPull(
        angleDifference(direction, frame.pointerAngle),
        minDimension,
      );
    }

    const intro = isStatic
      ? 1
      : introProgress(index, barCount, frame.timeMs);
    if (intro <= 0) continue;
    length *= intro;

    const clamped = clampBarToHero(
      start,
      { x: start.x + normal.x * length, y: start.y + normal.y * length },
      width,
      height,
    );
    if (clamped.length < SPECTRUM_MIN_BAR_LENGTH) continue;

    const midpoint = {
      x: (start.x + clamped.end.x) / 2,
      y: (start.y + clamped.end.y) / 2,
    };
    if (pointInExpandedRect(midpoint, contentRect)) continue;

    const behind = wrapAngle(trailHead - angle);
    bars.push({
      index,
      angle,
      start,
      end: clamped.end,
      length: clamped.length,
      lime: isTrailBar(behind),
      opacity: trailOpacity(behind),
    });
  }

  return bars;
}

/** The slice of the 2D context the spectrum needs. */
export interface SpectrumCanvasContext {
  globalAlpha: number;
  lineWidth: number;
  lineCap: string;
  strokeStyle: string;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
  clearRect(x: number, y: number, width: number, height: number): void;
}

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
 * Reads the design tokens so the canvas never hardcodes a similar looking
 * colour. Falls back to the token values when the variables are unavailable.
 */
export function readSpectrumPalette(styles: {
  getPropertyValue: (property: string) => string;
}): RadialPalette {
  const read = (property: string, fallback: string) => {
    const value = styles.getPropertyValue(property).trim();
    return value.length > 0 ? value : fallback;
  };

  return {
    ink: read('--color-text-primary', SPECTRUM_FALLBACK_PALETTE.ink),
    accent: read('--color-accent', SPECTRUM_FALLBACK_PALETTE.accent),
  };
}

/**
 * Draws the ring for one frame. Bars are batched by colour and quantized
 * opacity, so a 120 bar ring costs at most sixteen strokes instead of 120.
 */
export function drawRadialSpectrum(
  ctx: SpectrumCanvasContext,
  frame: RadialFrame,
  palette: RadialPalette = SPECTRUM_FALLBACK_PALETTE,
): number {
  const { width, height } = frame;
  ctx.clearRect(0, 0, Math.max(0, width), Math.max(0, height));
  if (width <= 0 || height <= 0) return 0;

  const bars = buildBars(frame);
  if (bars.length === 0) return 0;

  const buckets = new Map<string, RadialBar[]>();
  for (const bar of bars) {
    const alpha = quantizeOpacity(bar.opacity);
    if (alpha <= 0) continue;
    const key = `${bar.lime ? 'accent' : 'ink'}:${alpha}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(bar);
    } else {
      buckets.set(key, [bar]);
    }
  }

  ctx.lineWidth = SPECTRUM_STROKE_WIDTH;
  ctx.lineCap = 'round';

  let strokes = 0;

  // Ink first, then the lime trail, so the sweep always sits on top.
  const keys = [...buckets.keys()].sort((a, b) => {
    const inkFirst = Number(!a.startsWith('ink')) - Number(!b.startsWith('ink'));
    return inkFirst !== 0 ? inkFirst : a.localeCompare(b);
  });

  for (const key of keys) {
    const bucket = buckets.get(key);
    if (!bucket) continue;

    const [colour, alphaText] = key.split(':');
    const alpha = Number.parseFloat(alphaText);
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.strokeStyle = hexToRgba(
      colour === 'accent' ? palette.accent : palette.ink,
      1,
    );

    ctx.beginPath();
    for (const bar of bucket) {
      ctx.moveTo(bar.start.x, bar.start.y);
      ctx.lineTo(bar.end.x, bar.end.y);
    }
    ctx.stroke();
    strokes += 1;
  }

  ctx.globalAlpha = 1;
  return strokes;
}

/** The one deterministic pose used when motion is reduced. */
export function staticSpectrumFrame(
  width: number,
  height: number,
  ring: RadialRing,
  contentRect: Rect,
  barCount: number,
): RadialFrame {
  return {
    width,
    height,
    ring,
    contentRect,
    timeMs: 0,
    amplitude: 1,
    barCount,
    pointerAngle: null,
    static: true,
  };
}
