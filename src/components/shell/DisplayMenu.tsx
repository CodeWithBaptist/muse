'use client';

import * as React from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffectsLevel, useUiPrefs } from '@/hooks/use-ui-prefs';
import {
  LITE_MODES,
  UI_THEMES,
  type LiteMode,
  type UiTheme,
} from '@/lib/ui-prefs';
import { previewSound } from '@/lib/ui-sound';

/**
 * Theme, Lite mode, and sound, for everyone, on every page. A button opens
 * a small panel of labelled toggle groups; Escape or the close button shuts
 * it and focus returns to the button. The choices live on the device.
 */

const THEME_LABELS: Record<UiTheme, string> = { dark: 'Dark', light: 'Light' };
const LITE_LABELS: Record<LiteMode, string> = {
  auto: 'Auto',
  on: 'On',
  off: 'Off',
};
const SOUND_OPTIONS = ['off', 'on'] as const;
type SoundOption = (typeof SOUND_OPTIONS)[number];
const SOUND_LABELS: Record<SoundOption, string> = { off: 'Off', on: 'On' };

interface SegmentedProps<T extends string> {
  label: string;
  hint?: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (next: T) => void;
  testId: string;
}

function Segmented<T extends string>({
  label,
  hint,
  value,
  options,
  labels,
  onChange,
  testId,
}: SegmentedProps<T>) {
  const hintId = React.useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        {hint ? (
          <p id={hintId} className="text-xs text-text-muted">
            {hint}
          </p>
        ) : null}
      </div>
      <div
        role="group"
        aria-label={label}
        aria-describedby={hint ? hintId : undefined}
        data-testid={testId}
        className="inline-flex h-9 shrink-0 items-stretch rounded-md border border-border-subtle bg-background p-0.5"
      >
        {options.map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option)}
              className={cn(
                'min-w-[3rem] rounded-[5px] px-2.5 text-xs font-semibold transition-colors focus-ring',
                active
                  ? 'bg-surface text-text-primary'
                  : 'text-text-muted hover:text-text-secondary',
              )}
            >
              {labels[option]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DisplayMenu({ className }: { className?: string }) {
  const [prefs, setPrefs] = useUiPrefs();
  const level = useEffectsLevel();
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const close = React.useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        panelRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      )
        return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [close, open]);

  const liteHint =
    prefs.lite === 'auto'
      ? level === 'lite'
        ? 'On for now: this connection or phone asked for less.'
        : 'Turns on by itself on slow data.'
      : prefs.lite === 'on'
        ? 'Still screens, less to load.'
        : 'Everything moves, even on slow data.';

  return (
    <div className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Display settings"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'inline-flex h-11 w-11 items-center justify-center rounded-md transition-colors focus-ring',
          open
            ? 'bg-surface text-text-primary'
            : 'text-text-secondary hover:bg-surface hover:text-text-primary',
        )}
      >
        <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Display settings"
          data-testid="display-menu"
          className="absolute right-0 top-full z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] space-y-5 rounded-lg border border-border-strong bg-surface p-4 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <h2 className="type-section-label !text-text-primary">Display</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close display settings"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-background hover:text-text-primary focus-ring"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <Segmented
            label="Theme"
            hint="Dark is the default."
            testId="display-theme"
            value={prefs.theme}
            options={UI_THEMES}
            labels={THEME_LABELS}
            onChange={(theme) => setPrefs({ theme })}
          />
          <Segmented
            label="Lite mode"
            hint={liteHint}
            testId="display-lite"
            value={prefs.lite}
            options={LITE_MODES}
            labels={LITE_LABELS}
            onChange={(lite) => setPrefs({ lite })}
          />
          <Segmented
            label="Sound"
            hint="Short taps and chimes. Off until you say so."
            testId="display-sound"
            value={prefs.sound ? 'on' : 'off'}
            options={SOUND_OPTIONS}
            labels={SOUND_LABELS}
            onChange={(sound) => {
              setPrefs({ sound: sound === 'on' });
              if (sound === 'on') previewSound();
            }}
          />
          {level === 'none' ? (
            <p className="text-xs text-text-muted">
              Your system asks for reduced motion, so nothing decorative moves
              whatever is chosen here.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
