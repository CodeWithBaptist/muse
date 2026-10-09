import { getUiPrefs } from './ui-prefs-store';

/**
 * Short interface sounds, synthesised with the Web Audio API so nothing is
 * downloaded. Off by default: every call checks the device preference and
 * does nothing unless the visitor turned sound on. The context is created
 * lazily inside a user gesture, which is the only time browsers allow it,
 * and every failure is swallowed because a missing blip must never break a
 * page.
 */

export type UiSound = 'tap' | 'toggle' | 'arrive';

type AudioContextCtor = typeof AudioContext;

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (context) return context;
  const scope = window as Window & {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    context = null;
  }
  return context;
}

interface Note {
  /** Seconds after the call. */
  at: number;
  frequency: number;
  /** Glide target, when the note bends. */
  to?: number;
  durationMs: number;
  type: OscillatorType;
  gain: number;
}

const SOUNDS: Record<UiSound, Note[]> = {
  tap: [{ at: 0, frequency: 660, durationMs: 45, type: 'sine', gain: 0.06 }],
  toggle: [
    {
      at: 0,
      frequency: 520,
      to: 780,
      durationMs: 90,
      type: 'triangle',
      gain: 0.05,
    },
  ],
  arrive: [
    { at: 0, frequency: 523.25, durationMs: 110, type: 'triangle', gain: 0.05 },
    {
      at: 0.11,
      frequency: 783.99,
      durationMs: 160,
      type: 'triangle',
      gain: 0.05,
    },
  ],
};

function schedule(ctx: AudioContext, note: Note): void {
  const start = ctx.currentTime + note.at;
  const end = start + note.durationMs / 1000;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = note.type;
  oscillator.frequency.setValueAtTime(note.frequency, start);
  if (note.to) oscillator.frequency.linearRampToValueAtTime(note.to, end);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(note.gain, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

export function isSoundOn(): boolean {
  return getUiPrefs().sound;
}

/** Plays a sound if the visitor turned sound on and the page is visible. */
export function playSound(kind: UiSound): void {
  if (!isSoundOn()) return;
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible')
    return;
  try {
    const ctx = audioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    for (const note of SOUNDS[kind]) schedule(ctx, note);
  } catch {
    // No sound is never an error worth surfacing.
  }
}

/** The one sound that plays when sound is switched on, so the choice is audible. */
export function previewSound(): void {
  playSound('toggle');
}
