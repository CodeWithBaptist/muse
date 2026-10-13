'use client';

import * as React from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import {
  FloatingFocusManager,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { cn } from '@/lib/utils';
import { useEffectsLevel, useUiPrefs } from '@/hooks/use-ui-prefs';
import {
  LITE_MODES,
  UI_THEMES,
  type LiteMode,
  type UiTheme,
} from '@/lib/ui-prefs';

/**
 * Theme and Lite mode, for everyone, on every page. The desktop popover flips
 * and shifts into the viewport. On small screens, the same content is a
 * bottom sheet. The choices live on the device.
 */

const THEME_LABELS: Record<UiTheme, string> = { dark: 'Dark', light: 'Light' };
const LITE_LABELS: Record<LiteMode, string> = {
  auto: 'Auto',
  on: 'On',
  off: 'Off',
};

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
    <div className="flex flex-wrap items-center justify-between gap-4">
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
        className="inline-flex h-11 shrink-0 items-stretch rounded-md border border-border-subtle bg-background p-0.5"
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

function useSmallScreen() {
  const [smallScreen, setSmallScreen] = React.useState(false);

  React.useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      const update = () => setSmallScreen(window.innerWidth < 640);
      update();
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }

    const query = window.matchMedia('(max-width: 639px)');
    const update = () => setSmallScreen(query.matches);
    update();
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }

    query.addListener(update);
    return () => query.removeListener(update);
  }, []);

  return smallScreen;
}

export function DisplayMenu({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();
  const smallScreen = useSmallScreen();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (nextOpen, _event, reason) => {
      setOpen(nextOpen);
      if (!nextOpen && reason === 'escape-key') {
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    },
    placement: 'bottom-end',
    strategy: 'fixed',
    middleware: smallScreen
      ? []
      : [
          offset(8),
          flip({ padding: 16 }),
          shift({ padding: 16, crossAxis: true }),
          size({
            padding: 16,
            apply({ availableWidth, availableHeight, elements }) {
              elements.floating.style.maxWidth = `min(calc(100vw - 2rem), ${Math.max(0, Math.floor(availableWidth))}px)`;
              elements.floating.style.maxHeight = `${Math.max(0, Math.floor(availableHeight))}px`;
              elements.floating.style.overflowY = 'auto';
            },
          }),
        ],
    whileElementsMounted: autoUpdate,
  });

  const dismiss = useDismiss(context, {
    enabled: !smallScreen,
    escapeKey: true,
    outsidePress: true,
  });
  const role = useRole(context, { role: 'dialog' });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    dismiss,
    role,
  ]);

  const setReference = React.useCallback(
    (node: HTMLButtonElement | null) => {
      triggerRef.current = node;
      refs.setReference(node);
    },
    [refs],
  );
  const setFloating = React.useCallback(
    (node: HTMLDivElement | null) => refs.setFloating(node),
    [refs],
  );
  const close = React.useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  return (
    <div className={cn('relative', className)}>
      <button
        ref={setReference}
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
        {...getReferenceProps()}
      >
        <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
      </button>

      {open && smallScreen ? (
        <BottomSheet
          id={context.floatingId}
          open
          onClose={close}
          title="Display settings"
          testId="display-menu"
        >
          <DisplayOptions />
        </BottomSheet>
      ) : null}
      {open && !smallScreen ? (
        <FloatingPortal>
          <FloatingFocusManager
            context={context}
            modal={false}
            initialFocus={closeButtonRef}
            returnFocus
          >
            <div
              ref={setFloating}
              id={panelId}
              role="dialog"
              aria-label="Display settings"
              data-testid="display-menu"
              className={cn(
                'z-[100] space-y-5 overflow-y-auto overscroll-contain border border-border-strong bg-surface p-4 shadow-xl outline-none',
                'w-80 max-w-[calc(100vw-2rem)] rounded-lg',
              )}
              style={floatingStyles}
              {...getFloatingProps()}
            >
              <div className="flex items-center justify-between">
                <h2 className="type-section-label !text-text-primary">
                  Display
                </h2>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={close}
                  aria-label="Close display settings"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-md text-text-secondary hover:bg-background hover:text-text-primary focus-ring"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <DisplayOptions />
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      ) : null}
    </div>
  );
}

export function DisplayOptions() {
  const [prefs, setPrefs] = useUiPrefs();
  const level = useEffectsLevel();
  const liteHint =
    prefs.lite === 'auto'
      ? level === 'lite'
        ? 'On for now: this connection or phone asked for less.'
        : 'Turns on by itself on slow data.'
      : prefs.lite === 'on'
        ? 'Still screens, less to load.'
        : 'Everything moves, even on slow data.';

  return (
    <div className="space-y-5">
      {' '}
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
      {level === 'none' ? (
        <p className="text-xs text-text-muted">
          Your system asks for reduced motion, so nothing decorative moves
          whatever is chosen here.
        </p>
      ) : null}
    </div>
  );
}
