/**
 * Ridgeline hero math.
 *
 * Every value the canvas draws is computed here so the bell, the noise field,
 * the height, the beat envelope, the edge fade ramp, the band placement, and
 * the quality adaptation can be unit tested without a canvas or a browser.
 *
 * The canvas is the only place in the site that draws per frame.
 */

export const RIDGE_BPM = 96;
export const RIDGE_BEAT_MS = 60_000 / RIDGE_BPM;

export const RIDGE_LINE_COUNT_DESKTOP = 26;
export const RIDGE_LINE_COUNT_SMALL = 14;
export const RIDGE_SAMPLE_STEP_DESKTOP = 8;
export const RIDGE_SAMPLE_STEP_SMALL = 12;
export const RIDGE_SMALL_WIDTH = 640;

/** The ridge band sits between these fractions of the hero height. */
export const RIDGE_BAND_TOP = 0.5;
export const RIDGE_BAND_BOTTOM = 0.94;
/** Extra room kept below the hero content before the band may start. */
export const RIDGE_BAND_CONTENT_GAP = 0.06;
/** The band never shrinks below this fraction of the hero height. */
export const RIDGE_BAND_MIN = 0.08;
/** Gap kept between the hero content and the tallest ridge stroke. */
export const RIDGE_CONTENT_CLEARANCE = 6;

export const RIDGE_EDGE_FADE_RATIO = 0.12;
export const RIDGE_STROKE_WIDTH = 1.3;
export const RIDGE_FRONT_STROKE_WIDTH = 2.5;
export const RIDGE_BACK_OPACITY = 0.18;
export const RIDGE_FRONT_OPACITY = 0.4;
export const RIDGE_ACCENT_OPACITY = 0.95;
export const RIDGE_BASE_HEIGHT = 26;
export const RIDGE_BEAT_HEIGHT = 16;
export const RIDGE_NOISE_FLOOR = 0.35;
export const RIDGE_HOVER_AMPLITUDE = 2.2;
/** About 6 percent per frame toward the hover target. */
export const RIDGE_AMPLITUDE_EASE = 0.06;
export const RIDGE_POINTER_RADIUS = 46;
export const RIDGE_POINTER_SIGMA = 70;
export const RIDGE_POINTER_PEAK = 46;
/** Beat envelope decay. */
export const RIDGE_BEAT_DECAY = 5.5;
export const RIDGE_BELL_SIGMA = 0.24;

/** Frame budget used by the quality adaptation, in milliseconds. */
export const RIDGE_FRAME_BUDGET_MS = 16.7;
export const RIDGE_FRAME_PRESSURE_MS = 19.5;

export interface RidgeLayout {
  lineCount: number;
  sampleStep: number;
}

export interface RidgeBand {
  topY: number;
  bottomY: number;
}

export interface RidgePalette {
  background: string;
  ink: string;
  accent: string;
}

export const RIDGE_FALLBACK_PALETTE: RidgePalette = {
  background: '#0B0B0C',
  ink: '#F2F1ED',
  accent: '#A8E85C',
};

/**
 * Quality steps used when frames run long. Level 0 is the full spec, and each
 * step drops lines and samples further.
 */
export const RIDGE_QUALITY_LEVELS: RidgeLayout[] = [
  { lineCount: RIDGE_LINE_COUNT_DESKTOP, sampleStep: RIDGE_SAMPLE_STEP_DESKTOP },
  { lineCount: 18, sampleStep: 10 },
  { lineCount: 12, sampleStep: 14 },
];

export function ridgeLayout(width: number, qualityLevel = 0): RidgeLayout {
  const small = width < RIDGE_SMALL_WIDTH;
  const base: RidgeLayout = small
    ? { lineCount: RIDGE_LINE_COUNT_SMALL, sampleStep: RIDGE_SAMPLE_STEP_SMALL }
    : {
        lineCount: RIDGE_LINE_COUNT_DESKTOP,
        sampleStep: RIDGE_SAMPLE_STEP_DESKTOP,
      };

  if (qualityLevel <= 0) return base;

  const scale = RIDGE_QUALITY_LEVELS[Math.min(qualityLevel, RIDGE_QUALITY_LEVELS.length - 1)];
  const factor = scale.lineCount / RIDGE_LINE_COUNT_DESKTOP;
  const stepFactor = scale.sampleStep / RIDGE_SAMPLE_STEP_DESKTOP;

  return {
    lineCount: Math.max(6, Math.round(base.lineCount * factor)),
    sampleStep: Math.max(base.sampleStep, Math.round(base.sampleStep * stepFactor)),
  };
}

/**
 * Places the ridge band. It starts at the configured fraction of the hero, but
 * never behind the hero content: when the content reaches lower, the band moves
 * down so text contrast stays intact, keeping a minimum band height.
 */
export function ridgeBand(
  heroHeight: number,
  contentBottomY: number,
  options: {
    topRatio?: number;
    bottomRatio?: number;
    contentGap?: number;
    minBandRatio?: number;
  } = {},
): RidgeBand {
  const topRatio = options.topRatio ?? RIDGE_BAND_TOP;
  const bottomRatio = options.bottomRatio ?? RIDGE_BAND_BOTTOM;
  const contentGap = options.contentGap ?? RIDGE_BAND_CONTENT_GAP;
  const minBandRatio = options.minBandRatio ?? RIDGE_BAND_MIN;

  const contentRatio =
    heroHeight > 0 ? Math.max(0, contentBottomY) / heroHeight : 0;

  let start = Math.max(topRatio, contentRatio + contentGap);
  start = Math.min(start, bottomRatio - minBandRatio);

  return {
    topY: start * heroHeight,
    bottomY: bottomRatio * heroHeight,
  };
}

/** Baselines spaced evenly through the band, back to front. */
export function lineBaselines(band: RidgeBand, lineCount: number): number[] {
  if (lineCount <= 1) return [band.bottomY];
  const step = (band.bottomY - band.topY) / (lineCount - 1);
  return Array.from({ length: lineCount }, (_, index) => band.topY + index * step);
}

/** The tallest a line may rise so its stroke never reaches the hero content. */
export function ridgeHeightCeiling(
  baselineY: number,
  contentBottomY: number,
  clearance = RIDGE_CONTENT_CLEARANCE,
): number {
  return Math.max(0, baselineY - contentBottomY - clearance);
}

/** Beat phase within the current beat, 0 to 1. */
export function beatPhase(nowMs: number, bpm = RIDGE_BPM): number {
  const beatMs = 60_000 / bpm;
  const phase = (nowMs % beatMs) / beatMs;
  return phase < 0 ? phase + 1 : phase;
}

/** Beat envelope, 1 at the beat and decaying through the beat. */
export function beatEnvelope(
  nowMs: number,
  bpm = RIDGE_BPM,
  decay = RIDGE_BEAT_DECAY,
): number {
  return Math.exp(-beatPhase(nowMs, bpm) * decay);
}

/** Centred bell that keeps the ends of every line near the baseline. */
export function bellAt(x: number, width: number, sigma = RIDGE_BELL_SIGMA): number {
  if (width <= 0) return 0;
  const offset = (x - width / 2) / (width * sigma);
  return Math.exp(-(offset * offset));
}

/** Slow two sine noise field, 0 to 1. */
export function noiseAt(x: number, t: number, index: number): number {
  return (
    0.5 +
    0.5 *
      Math.sin(x * 0.045 + t * 1.2 + index * 1.7) *
      Math.sin(x * 0.019 - t * 0.7 + index)
  );
}

export interface RidgeHeightOptions {
  x: number;
  width: number;
  t: number;
  index: number;
  beat: number;
  amplitude?: number;
}

/** Height of a line above its baseline at x. */
export function ridgeHeight({
  x,
  width,
  t,
  index,
  beat,
  amplitude = 1,
}: RidgeHeightOptions): number {
  const bell = bellAt(x, width);
  const noise = noiseAt(x, t, index);
  return (
    bell *
    (RIDGE_BASE_HEIGHT + beat * RIDGE_BEAT_HEIGHT) *
    (RIDGE_NOISE_FLOOR + noise) *
    amplitude
  );
}

/** Pointer bump added to a line when the pointer sits close to its baseline. */
export function pointerBump(
  x: number,
  pointerX: number,
  distanceY: number,
  radius = RIDGE_POINTER_RADIUS,
  sigma = RIDGE_POINTER_SIGMA,
  peak = RIDGE_POINTER_PEAK,
): number {
  if (distanceY >= radius) return 0;
  const offset = (x - pointerX) / sigma;
  return Math.exp(-(offset * offset)) * peak * (1 - distanceY / radius);
}

/** Horizontal opacity ramp so no line runs flat to the edges. */
export function edgeFadeOpacity(
  x: number,
  width: number,
  ratio = RIDGE_EDGE_FADE_RATIO,
): number {
  if (width <= 0) return 0;
  const edge = width * ratio;
  if (x <= 0 || x >= width) return 0;
  if (x < edge) return x / edge;
  if (x > width - edge) return (width - x) / edge;
  return 1;
}

export function lineOpacity(index: number, lineCount: number): number {
  if (lineCount <= 1) return RIDGE_FRONT_OPACITY;
  return (
    RIDGE_BACK_OPACITY +
    (RIDGE_FRONT_OPACITY - RIDGE_BACK_OPACITY) * (index / (lineCount - 1))
  );
}

export function isFrontLine(index: number, lineCount: number): boolean {
  return index === lineCount - 1;
}

/** Eases the hover amplitude toward its target. */
export function easeAmplitude(
  current: number,
  target: number,
  factor = RIDGE_AMPLITUDE_EASE,
): number {
  const next = current + (target - current) * factor;
  return Math.abs(target - next) < 0.001 ? target : next;
}

/**
 * Quality adaptation. Frames that keep running long move the level down, which
 * drops line count and increases the sample step.
 */
export function nextQualityLevel(
  current: number,
  averageFrameMs: number,
  maxLevel = RIDGE_QUALITY_LEVELS.length - 1,
): number {
  if (averageFrameMs > RIDGE_FRAME_PRESSURE_MS) {
    return Math.min(current + 1, maxLevel);
  }
  return current;
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

  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Reads the design tokens so the canvas never hardcodes a similar looking
 * colour. Falls back to the token values when the variables are unavailable.
 */
export function readRidgePalette(styles: {
  getPropertyValue: (property: string) => string;
}): RidgePalette {
  const read = (property: string, fallback: string) => {
    const value = styles.getPropertyValue(property).trim();
    return value.length > 0 ? value : fallback;
  };

  return {
    background: read('--color-background', RIDGE_FALLBACK_PALETTE.background),
    ink: read('--color-text-primary', RIDGE_FALLBACK_PALETTE.ink),
    accent: read('--color-accent', RIDGE_FALLBACK_PALETTE.accent),
  };
}
