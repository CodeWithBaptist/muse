// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isSoundOn, playSound, previewSound } from './ui-sound';
import { DEFAULT_UI_PREFS } from './ui-prefs';
import { setUiPrefs } from './ui-prefs-store';

class FakeParam {
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

class FakeOscillator {
  type = 'sine';
  frequency = new FakeParam();
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeGain {
  gain = new FakeParam();
  connect = vi.fn();
}

const created = { contexts: 0, oscillators: [] as FakeOscillator[] };

class FakeAudioContext {
  currentTime = 0;
  state = 'running';
  destination = {};
  constructor() {
    created.contexts += 1;
  }
  resume = vi.fn(() => Promise.resolve());
  createOscillator() {
    const oscillator = new FakeOscillator();
    created.oscillators.push(oscillator);
    return oscillator;
  }
  createGain() {
    return new FakeGain();
  }
}

describe('ui sound', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setUiPrefs(DEFAULT_UI_PREFS);
    created.contexts = 0;
    created.oscillators = [];
    vi.stubGlobal('AudioContext', FakeAudioContext);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is off by default and never even creates an audio context', () => {
    expect(isSoundOn()).toBe(false);
    playSound('tap');
    playSound('arrive');
    expect(created.contexts).toBe(0);
    expect(created.oscillators).toHaveLength(0);
  });

  it('synthesises short notes once switched on, reusing one context', () => {
    setUiPrefs({ sound: true });
    expect(isSoundOn()).toBe(true);
    previewSound();
    expect(created.contexts).toBe(1);
    expect(created.oscillators).toHaveLength(1);
    expect(created.oscillators[0].type).toBe('triangle');
    expect(created.oscillators[0].start).toHaveBeenCalled();
    expect(created.oscillators[0].stop).toHaveBeenCalled();

    playSound('arrive');
    expect(created.contexts).toBe(1);
    expect(created.oscillators).toHaveLength(3);
  });

  it('swallows a browser without Web Audio', () => {
    vi.stubGlobal('AudioContext', undefined);
    setUiPrefs({ sound: true });
    expect(() => playSound('tap')).not.toThrow();
  });
});
