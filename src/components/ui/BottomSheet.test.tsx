import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { BottomSheet } from './BottomSheet';

function Example() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open sheet</button>
      <BottomSheet open={open} title="Example" onClose={() => setOpen(false)}>
        <button>First action</button>
        <a href="#last">Last action</a>
      </BottomSheet>
    </>
  );
}
function open() {
  const trigger = screen.getByRole('button', { name: 'Open sheet' });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}
afterEach(() => vi.unstubAllGlobals());

describe('shared sheet', () => {
  it('names the modal, focuses Close, cycles Tab, restores focus and body scrolling on Escape', () => {
    document.body.style.overflow = 'auto';
    render(<Example />);
    const trigger = open();
    const dialog = screen.getByRole('dialog', { name: 'Example' });
    const close = screen.getByRole('button', { name: 'Close example' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.activeElement).toBe(close);
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(
      screen.getByRole('link', { name: 'Last action' }),
    );
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe('auto');
  });
  it('dismisses on backdrop, native cancel, Close and a downward handle swipe, not a horizontal swipe', () => {
    render(<Example />);
    open();
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).toBeNull();
    open();
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { cancelable: true }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Close example' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    open();
    const handle = screen.getByTestId('sheet-drag-handle');
    fireEvent.touchStart(handle, { touches: [{ clientX: 50, clientY: 30 }] });
    fireEvent.touchEnd(handle, {
      changedTouches: [{ clientX: 160, clientY: 130 }],
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.touchStart(handle, { touches: [{ clientX: 50, clientY: 30 }] });
    fireEvent.touchEnd(handle, {
      changedTouches: [{ clientX: 55, clientY: 130 }],
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('restores body overflow on unmount', () => {
    document.body.style.overflow = '';
    const { unmount } = render(<Example />);
    open();
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
  it('uses an 85dvh scroll bound, safe-area padding and token motion with instant Lite and reduced states', () => {
    const css = readFileSync('src/app/globals.css', 'utf8');
    expect(css).toContain('max-height: 85dvh');
    expect(css).toContain('env(safe-area-inset-bottom, 0px)');
    expect(css).toContain('var(--duration-base) var(--ease-standard)');
    expect(css).toContain("[data-sheet-effects='lite']");
    expect(css).toContain("[data-sheet-effects='none']");
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.muse-sheet-panel[\s\S]*?animation: none/,
    );
  });
});
