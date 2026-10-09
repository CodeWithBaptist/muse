// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_UI_PREFS,
  UI_PREFS_BOOTSTRAP_SCRIPT,
  UI_PREFS_STORAGE_KEY,
  normaliseUiPrefs,
  resolveEffectsLevel,
} from './ui-prefs';
import {
  applyUiPrefsToDocument,
  getEffectsLevel,
  getUiPrefs,
  setUiPrefs,
  subscribeUiPrefs,
} from './ui-prefs-store';

function stubMatchMedia(reduced: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduced && query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

/** Runs the head script against a fresh document and returns what it stamped. */
function runBootstrap(
  saved: unknown,
  connection?: Record<string, unknown>,
  reduced = false,
) {
  window.localStorage.clear();
  if (saved !== undefined) {
    window.localStorage.setItem(UI_PREFS_STORAGE_KEY, JSON.stringify(saved));
  }
  stubMatchMedia(reduced);
  Object.defineProperty(navigator, 'connection', {
    value: connection,
    configurable: true,
  });
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  root.removeAttribute('data-effects');
  // eslint-disable-next-line no-new-func
  new Function(UI_PREFS_BOOTSTRAP_SCRIPT)();
  return {
    theme: root.getAttribute('data-theme'),
    effects: root.getAttribute('data-effects'),
  };
}

describe('display preferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
    stubMatchMedia(false);
    Object.defineProperty(navigator, 'connection', {
      value: undefined,
      configurable: true,
    });
    setUiPrefs(DEFAULT_UI_PREFS);
    window.localStorage.clear();
  });

  it('defaults to dark, Lite on auto, and sound off, dropping anything unknown', () => {
    expect(getUiPrefs()).toEqual({ theme: 'dark', lite: 'auto', sound: false });
    expect(
      normaliseUiPrefs({ theme: 'sepia', lite: 'maybe', sound: 'yes' }),
    ).toEqual(DEFAULT_UI_PREFS);
    expect(
      normaliseUiPrefs({ theme: 'light', lite: 'on', sound: true }),
    ).toEqual({
      theme: 'light',
      lite: 'on',
      sound: true,
    });
  });

  it('resolves the effects level: reduced motion wins, then the choice, then the connection', () => {
    const quiet = { reducedMotion: true };
    const fast = { reducedMotion: false, effectiveType: '4g', saveData: false };
    const slow = { reducedMotion: false, effectiveType: '2g' };
    const saver = { reducedMotion: false, saveData: true };
    const smallPhone = { reducedMotion: false, deviceMemory: 2 };
    expect(
      resolveEffectsLevel({ ...DEFAULT_UI_PREFS, lite: 'off' }, quiet),
    ).toBe('none');
    expect(resolveEffectsLevel(DEFAULT_UI_PREFS, fast)).toBe('full');
    expect(resolveEffectsLevel(DEFAULT_UI_PREFS, slow)).toBe('lite');
    expect(resolveEffectsLevel(DEFAULT_UI_PREFS, saver)).toBe('lite');
    expect(resolveEffectsLevel(DEFAULT_UI_PREFS, smallPhone)).toBe('lite');
    expect(
      resolveEffectsLevel({ ...DEFAULT_UI_PREFS, lite: 'off' }, slow),
    ).toBe('full');
    expect(resolveEffectsLevel({ ...DEFAULT_UI_PREFS, lite: 'on' }, fast)).toBe(
      'lite',
    );
  });

  it('saves a choice, stamps <html> at once, and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeUiPrefs(listener);
    setUiPrefs({ theme: 'light', sound: true });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.documentElement.getAttribute('data-effects')).toBe('full');
    expect(
      JSON.parse(window.localStorage.getItem(UI_PREFS_STORAGE_KEY) ?? ''),
    ).toEqual({
      theme: 'light',
      lite: 'auto',
      sound: true,
    });
    setUiPrefs({ lite: 'on' });
    expect(getEffectsLevel()).toBe('lite');
    expect(document.documentElement.getAttribute('data-effects')).toBe('lite');
    unsubscribe();
  });

  it('the head script agrees with resolveEffectsLevel before React runs', () => {
    expect(runBootstrap(undefined)).toEqual({ theme: 'dark', effects: 'full' });
    expect(runBootstrap({ theme: 'light' })).toEqual({
      theme: 'light',
      effects: 'full',
    });
    expect(runBootstrap({}, { effectiveType: '2g' })).toEqual({
      theme: 'dark',
      effects: 'lite',
    });
    expect(runBootstrap({}, { saveData: true })).toEqual({
      theme: 'dark',
      effects: 'lite',
    });
    expect(runBootstrap({ lite: 'off' }, { saveData: true })).toEqual({
      theme: 'dark',
      effects: 'full',
    });
    expect(runBootstrap({ lite: 'on' })).toEqual({
      theme: 'dark',
      effects: 'lite',
    });
    expect(runBootstrap({}, undefined, true)).toEqual({
      theme: 'dark',
      effects: 'none',
    });
    expect(runBootstrap('not json at all' as unknown)).toEqual({
      theme: 'dark',
      effects: 'full',
    });
    // Whatever the script stamps, applyUiPrefsToDocument reaches the same answer.
    applyUiPrefsToDocument();
    expect(document.documentElement.getAttribute('data-effects')).toBe('full');
  });
});
