/**
 * The visitor's display choices: theme and Lite mode.
 * Kept on the device, applied to <html> before the first paint by the
 * bootstrap script, and read by every effect through useEffectsLevel so
 * nothing moving ever ignores them.
 */

export const UI_THEMES = ['dark', 'light'] as const;
export type UiTheme = (typeof UI_THEMES)[number];

export const LITE_MODES = ['auto', 'on', 'off'] as const;
export type LiteMode = (typeof LITE_MODES)[number];

export interface UiPrefs {
  /** Dark is the brand default; light is a choice, never inferred from the OS. */
  theme: UiTheme;
  /** `auto` turns Lite on for slow connections and Save-Data. */
  lite: LiteMode;
}

export const DEFAULT_UI_PREFS: UiPrefs = Object.freeze({
  theme: 'dark',
  lite: 'auto',
});

export const UI_PREFS_STORAGE_KEY = 'muse.ui.prefs.v1';

export function normaliseUiPrefs(value: unknown): UiPrefs {
  if (!value || typeof value !== 'object') return DEFAULT_UI_PREFS;
  const candidate = value as Partial<Record<keyof UiPrefs, unknown>>;
  return {
    theme: (UI_THEMES as readonly unknown[]).includes(candidate.theme)
      ? (candidate.theme as UiTheme)
      : DEFAULT_UI_PREFS.theme,
    lite: (LITE_MODES as readonly unknown[]).includes(candidate.lite)
      ? (candidate.lite as LiteMode)
      : DEFAULT_UI_PREFS.lite,
  };
}

/** How much the interface is allowed to move and load. */
export type EffectsLevel = 'full' | 'lite' | 'none';

export interface EffectsEnvironment {
  reducedMotion: boolean;
  /** navigator.connection.saveData, when the browser exposes it. */
  saveData?: boolean;
  /** navigator.connection.effectiveType, when the browser exposes it. */
  effectiveType?: string;
  /** navigator.deviceMemory in GB, when the browser exposes it. */
  deviceMemory?: number;
}

/** True when the connection or the device suggests spending less. */
export function environmentWantsLite(env: EffectsEnvironment): boolean {
  if (env.saveData) return true;
  if (env.effectiveType === 'slow-2g' || env.effectiveType === '2g')
    return true;
  if (
    typeof env.deviceMemory === 'number' &&
    env.deviceMemory > 0 &&
    env.deviceMemory <= 2
  ) {
    return true;
  }
  return false;
}

/**
 * Reduced motion wins outright: nothing decorative moves. Lite keeps the
 * interface still and skips the heavy layers but leaves state changes
 * animated. Full is everything.
 */
export function resolveEffectsLevel(
  prefs: UiPrefs,
  env: EffectsEnvironment,
): EffectsLevel {
  if (env.reducedMotion) return 'none';
  if (prefs.lite === 'on') return 'lite';
  if (prefs.lite === 'auto' && environmentWantsLite(env)) return 'lite';
  return 'full';
}

/**
 * Runs in <head> before anything paints: reads the saved choices and the
 * connection, and marks <html> so the stylesheet can pick the theme and
 * hold still in Lite mode with no flash. Plain ES5 so every browser that
 * reaches the page can run it. Mirrors resolveEffectsLevel above; the unit
 * test keeps the two in step.
 */
export const UI_PREFS_BOOTSTRAP_SCRIPT = `(function(){try{var d=document.documentElement;var p={};try{p=JSON.parse(localStorage.getItem(${JSON.stringify(UI_PREFS_STORAGE_KEY)})||'{}')||{}}catch(e){}var theme=p.theme==='light'?'light':'dark';d.setAttribute('data-theme',theme);d.style.colorScheme=theme;var c=navigator.connection||navigator.mozConnection||navigator.webkitConnection||null;var slow=!!(c&&(c.saveData||c.effectiveType==='slow-2g'||c.effectiveType==='2g'));var lowMem=typeof navigator.deviceMemory==='number'&&navigator.deviceMemory>0&&navigator.deviceMemory<=2;var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;var lite=p.lite==='on'||(p.lite!=='off'&&(slow||lowMem));d.setAttribute('data-effects',reduced?'none':lite?'lite':'full');}catch(e){}})();`;
