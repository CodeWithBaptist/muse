'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useEffectsLevel } from '@/hooks/use-ui-prefs';

let locks = 0;
let previousOverflow = '';

/** Native modal semantics plus explicit keyboard cycling and touch dismissal. */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  testId,
  id,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  testId?: string;
  id?: string;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const touch = React.useRef<{ x: number; y: number } | null>(null);
  const titleId = React.useId();
  const level = useEffectsLevel();
  React.useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (locks++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    dialog.showModal();
    closeRef.current?.focus();
    return () => {
      dialog.close();
      if (--locks === 0) document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <dialog
      id={id}
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid={testId}
      data-sheet-effects={level}
      className="muse-sheet"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          event.preventDefault();
          onClose();
          return;
        }
        if (event.key !== 'Tab') return;
        event.stopPropagation();
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
          ),
        )
          .filter(
            (element) =>
              element.tabIndex >= 0 &&
              !element.closest('[hidden], [inert], [aria-hidden="true"]'),
          )
          .sort((a, b) =>
            a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
              ? -1
              : 1,
          );
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <section className="muse-sheet-panel" aria-labelledby={titleId}>
        <div
          aria-hidden="true"
          className="flex h-6 shrink-0 touch-pan-x items-center justify-center"
          data-testid="sheet-drag-handle"
          onTouchStart={(event) => {
            const point = event.touches[0];
            touch.current = { x: point.clientX, y: point.clientY };
          }}
          onTouchEnd={(event) => {
            const point = event.changedTouches[0];
            const start = touch.current;
            touch.current = null;
            if (
              start &&
              point.clientY - start.y > 72 &&
              Math.abs(point.clientX - start.x) < 80
            )
              onClose();
          }}
        >
          <span className="h-1 w-10 rounded-full bg-border-strong" />
        </div>
        <header className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2">
          <h2
            id={titleId}
            className="min-w-0 break-words text-base font-semibold"
          >
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={`Close ${title.toLowerCase()}`}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md focus-ring"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="muse-sheet-content min-h-0 overflow-y-auto overscroll-contain px-4">
          {children}
        </div>
      </section>
    </dialog>,
    document.body,
  );
}
