import { describe, expect, it } from 'vitest';
import {
  RIDGE_BACK_OPACITY,
  RIDGE_BEAT_MS,
  RIDGE_FRONT_OPACITY,
  RIDGE_LINE_COUNT_DESKTOP,
  RIDGE_LINE_COUNT_SMALL,
  RIDGE_POINTER_RADIUS,
  RIDGE_SAMPLE_STEP_DESKTOP,
  RIDGE_SAMPLE_STEP_SMALL,
  beatEnvelope,
  beatPhase,
  bellAt,
  easeAmplitude,
  edgeFadeOpacity,
  hexToRgba,
  isFrontLine,
  lineBaselines,
  lineOpacity,
  nextQualityLevel,
  noiseAt,
  pointerBump,
  readRidgePalette,
  ridgeBand,
  ridgeHeight,
  ridgeHeightCeiling,
  ridgeLayout,
} from './ridgeline';

describe('ridgeline beat', () => {
  it('wraps within a 96 BPM beat', () => {
    expect(RIDGE_BEAT_MS).toBeCloseTo(625, 5);
    expect(beatPhase(0)).toBe(0);
    expect(beatPhase(RIDGE_BEAT_MS / 2)).toBeCloseTo(0.5, 5);
    expect(beatPhase(RIDGE_BEAT_MS)).toBeCloseTo(0, 5);
    expect(beatPhase(RIDGE_BEAT_MS * 3 + RIDGE_BEAT_MS / 4)).toBeCloseTo(0.25, 5);
  });

  it('decays through the beat and restarts at the next beat', () => {
    expect(beatEnvelope(0)).toBeCloseTo(1, 5);
    const early = beatEnvelope(RIDGE_BEAT_MS * 0.1);
    const middle = beatEnvelope(RIDGE_BEAT_MS * 0.5);
    const late = beatEnvelope(RIDGE_BEAT_MS * 0.9);

    expect(early).toBeLessThan(1);
    expect(middle).toBeLessThan(early);
    expect(late).toBeLessThan(middle);
    expect(late).toBeGreaterThan(0);
    expect(beatEnvelope(RIDGE_BEAT_MS)).toBeCloseTo(1, 5);
  });
});

describe('ridgeline shape', () => {
  it('keeps the bell centred and near zero at the edges', () => {
    const width = 1440;
    expect(bellAt(width / 2, width)).toBeCloseTo(1, 5);
    expect(bellAt(0, width)).toBeLessThan(0.02);
    expect(bellAt(width, width)).toBeLessThan(0.02);
    expect(bellAt(width / 2 - 100, width)).toBeCloseTo(
      bellAt(width / 2 + 100, width),
      6,
    );
  });

  it('keeps the noise field inside zero to one', () => {
    for (let x = 0; x <= 1440; x += 37) {
      for (let t = 0; t < 4; t += 0.31) {
        const noise = noiseAt(x, t, 3);
        expect(noise).toBeGreaterThanOrEqual(0);
        expect(noise).toBeLessThanOrEqual(1);
      }
    }
  });

  it('builds heights inside the expected range for a beat', () => {
    const width = 1440;
    const center = width / 2;

    const quiet = ridgeHeight({
      x: center,
      width,
      t: 0,
      index: 4,
      beat: 0,
    });
    const onBeat = ridgeHeight({
      x: center,
      width,
      t: 0,
      index: 4,
      beat: 1,
    });

    expect(quiet).toBeGreaterThan(0);
    expect(onBeat).toBeGreaterThan(quiet);
    // bell 1, height 26 to 42, noise factor 0.35 to 1.35
    expect(quiet).toBeGreaterThanOrEqual(26 * 0.35 - 1e-6);
    expect(onBeat).toBeLessThanOrEqual(42 * 1.35 + 1e-6);
  });

  it('scales with the hover amplitude and fades away at the edges', () => {
    const width = 1440;
    const center = width / 2;
    const single = ridgeHeight({ x: center, width, t: 0.5, index: 2, beat: 0.4 });
    const doubled = ridgeHeight({
      x: center,
      width,
      t: 0.5,
      index: 2,
      beat: 0.4,
      amplitude: 2.2,
    });

    expect(doubled).toBeCloseTo(single * 2.2, 5);
    expect(ridgeHeight({ x: 0, width, t: 0.5, index: 2, beat: 1 })).toBeLessThan(0.5);
  });
});

describe('ridgeline edge fade', () => {
  it('fades to nothing over the outer twelve percent', () => {
    const width = 1000;
    expect(edgeFadeOpacity(0, width)).toBe(0);
    expect(edgeFadeOpacity(width, width)).toBe(0);
    expect(edgeFadeOpacity(width * 0.06, width)).toBeCloseTo(0.5, 5);
    expect(edgeFadeOpacity(width * 0.5, width)).toBe(1);
    expect(edgeFadeOpacity(width * 0.94, width)).toBeCloseTo(0.5, 5);
    expect(edgeFadeOpacity(width * 0.11, width)).toBeLessThan(1);
    expect(edgeFadeOpacity(width * 0.89, width)).toBeLessThan(1);
  });

  it('ramps the whole stroke line opacity from back to front', () => {
    expect(lineOpacity(0, 26)).toBeCloseTo(RIDGE_BACK_OPACITY, 5);
    expect(lineOpacity(25, 26)).toBeCloseTo(RIDGE_FRONT_OPACITY, 5);
    expect(lineOpacity(13, 26)).toBeGreaterThan(RIDGE_BACK_OPACITY);
    expect(isFrontLine(25, 26)).toBe(true);
    expect(isFrontLine(24, 26)).toBe(false);
  });
});

describe('ridgeline band', () => {
  it('uses the configured band when the hero content stays high', () => {
    const band = ridgeBand(1000, 200);
    expect(band.topY).toBeCloseTo(500, 5);
    expect(band.bottomY).toBeCloseTo(940, 5);
  });

  it('moves down when the hero content reaches into the band', () => {
    const contentBottom = 640;
    const band = ridgeBand(1000, contentBottom);
    expect(band.topY).toBeGreaterThan(contentBottom);
    expect(band.topY).toBeCloseTo(700, 5);
    expect(band.bottomY).toBeCloseTo(940, 5);
  });

  it('keeps a minimum band height when the content fills the hero', () => {
    const band = ridgeBand(1000, 960);
    expect(band.bottomY - band.topY).toBeGreaterThanOrEqual(80 - 1e-6);
  });

  it('spaces baselines evenly from back to front', () => {
    const band = { topY: 600, bottomY: 900 };
    const baselines = lineBaselines(band, 5);
    expect(baselines[0]).toBe(600);
    expect(baselines[4]).toBe(900);
    expect(baselines[1] - baselines[0]).toBeCloseTo(75, 5);
  });

  it('caps line height so no stroke reaches the hero content', () => {
    expect(ridgeHeightCeiling(700, 640)).toBeCloseTo(54, 5);
    expect(ridgeHeightCeiling(620, 640)).toBe(0);
  });
});

describe('ridgeline layout and adaptation', () => {
  it('uses 26 lines on desktop and 14 on small screens', () => {
    expect(ridgeLayout(1440)).toEqual({
      lineCount: RIDGE_LINE_COUNT_DESKTOP,
      sampleStep: RIDGE_SAMPLE_STEP_DESKTOP,
    });
    expect(ridgeLayout(375)).toEqual({
      lineCount: RIDGE_LINE_COUNT_SMALL,
      sampleStep: RIDGE_SAMPLE_STEP_SMALL,
    });
    expect(ridgeLayout(639).lineCount).toBe(RIDGE_LINE_COUNT_SMALL);
    expect(ridgeLayout(640).lineCount).toBe(RIDGE_LINE_COUNT_DESKTOP);
  });

  it('drops lines and samples further when frames run long', () => {
    const full = ridgeLayout(1440, 0);
    const reduced = ridgeLayout(1440, 1);
    const minimal = ridgeLayout(1440, 2);

    expect(reduced.lineCount).toBeLessThan(full.lineCount);
    expect(reduced.sampleStep).toBeGreaterThan(full.sampleStep);
    expect(minimal.lineCount).toBeLessThan(reduced.lineCount);
    expect(minimal.sampleStep).toBeGreaterThan(reduced.sampleStep);
  });

  it('only steps down the quality level when frames are over budget', () => {
    expect(nextQualityLevel(0, 12)).toBe(0);
    expect(nextQualityLevel(0, 24)).toBe(1);
    expect(nextQualityLevel(2, 40)).toBe(2);
  });
});

describe('ridgeline pointer and hover', () => {
  it('bumps the line under the pointer and nothing else', () => {
    expect(pointerBump(400, 400, 0)).toBeCloseTo(RIDGE_POINTER_RADIUS, 5);
    expect(pointerBump(400, 400, RIDGE_POINTER_RADIUS)).toBe(0);
    expect(pointerBump(400, 400, RIDGE_POINTER_RADIUS + 5)).toBe(0);
    expect(pointerBump(400, 400, RIDGE_POINTER_RADIUS / 2)).toBeCloseTo(
      RIDGE_POINTER_RADIUS / 2,
      5,
    );
    expect(pointerBump(400, 700, 0)).toBeLessThan(0.1);
  });

  it('eases the hover amplitude toward the target', () => {
    const first = easeAmplitude(1, 2.2);
    expect(first).toBeGreaterThan(1);
    expect(first).toBeLessThan(2.2);

    let value = 1;
    for (let frame = 0; frame < 200; frame += 1) {
      value = easeAmplitude(value, 2.2);
    }
    expect(value).toBeCloseTo(2.2, 3);

    let relaxing = 2.2;
    for (let frame = 0; frame < 200; frame += 1) {
      relaxing = easeAmplitude(relaxing, 1);
    }
    expect(relaxing).toBeCloseTo(1, 3);
  });
});

describe('ridgeline palette', () => {
  it('converts design tokens to canvas colours', () => {
    expect(hexToRgba('#F2F1ED', 0.4)).toBe('rgba(242, 241, 237, 0.4)');
    expect(hexToRgba('#A8E85C', 0.95)).toBe('rgba(168, 232, 92, 0.95)');
    expect(hexToRgba('#FFF', 1)).toBe('rgba(255, 255, 255, 1)');
    expect(hexToRgba('nonsense', 0.5)).toBe('rgba(242, 241, 237, 0.5)');
  });

  it('reads the CSS variables and falls back to the tokens', () => {
    const values: Record<string, string> = {
      '--color-background': '#0B0B0C',
      '--color-text-primary': '#F2F1ED',
      '--color-accent': '#A8E85C',
    };
    expect(
      readRidgePalette({ getPropertyValue: (property) => values[property] ?? '' }),
    ).toEqual({
      background: '#0B0B0C',
      ink: '#F2F1ED',
      accent: '#A8E85C',
    });

    expect(
      readRidgePalette({ getPropertyValue: () => '' }),
    ).toEqual({
      background: '#0B0B0C',
      ink: '#F2F1ED',
      accent: '#A8E85C',
    });
  });
});
