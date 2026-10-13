import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shouldHideChatChrome, useChatViewport } from './use-chat-viewport';

function Example() {
  useChatViewport();
  return (
    <>
      <textarea id="chat-message-input" aria-label="Chat" />
      <button>Elsewhere</button>
      <div data-chat-messages />
    </>
  );
}
let viewport: EventTarget & {
  height: number;
  offsetTop: number;
  scale: number;
};
beforeEach(() => {
  vi.stubGlobal('innerWidth', 390);
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  viewport = Object.assign(new EventTarget(), {
    height: 420,
    offsetTop: 12,
    scale: 1,
  });
  vi.stubGlobal('visualViewport', viewport);
});
afterEach(() => vi.unstubAllGlobals());

describe('touch chat viewport', () => {
  it.each([
    [true, true, 390, true],
    [true, true, 1024, true],
    [false, true, 390, false],
    [true, false, 390, false],
    [true, true, 1280, false],
  ] as const)(
    'focus %s touch %s width %s hides chrome %s',
    (focus, touch, width, expected) => {
      expect(shouldHideChatChrome(focus, touch, width)).toBe(expected);
    },
  );
  it('hides chrome immediately on focus, follows viewport resize and restores on blur and unmount', () => {
    const { unmount } = render(<Example />);
    const root = document.documentElement;
    expect(root).not.toHaveAttribute('data-keyboard-visible');
    act(() => screen.getByLabelText('Chat').focus());
    expect(root).toHaveAttribute('data-keyboard-visible', 'true');
    expect(root.style.getPropertyValue('--muse-visual-viewport-height')).toBe(
      '420px',
    );
    viewport.height = 350;
    act(() => viewport.dispatchEvent(new Event('resize')));
    expect(root.style.getPropertyValue('--muse-visual-viewport-height')).toBe(
      '350px',
    );
    act(() => screen.getByRole('button').focus());
    expect(root).not.toHaveAttribute('data-keyboard-visible');
    expect(root.style.getPropertyValue('--muse-visual-viewport-height')).toBe(
      '',
    );
    act(() => screen.getByLabelText('Chat').focus());
    unmount();
    expect(root).not.toHaveAttribute('data-keyboard-visible');
  });
  it('works without VisualViewport and does not infer a keyboard from viewport shrink alone', () => {
    vi.stubGlobal('visualViewport', undefined);
    render(<Example />);
    expect(document.documentElement).not.toHaveAttribute(
      'data-keyboard-visible',
    );
    act(() => screen.getByLabelText('Chat').focus());
    expect(document.documentElement).toHaveAttribute(
      'data-keyboard-visible',
      'true',
    );
  });
  it('keeps the latest message visible after a viewport event', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const { container } = render(<Example />);
    const messages = container.querySelector<HTMLElement>(
      '[data-chat-messages]',
    )!;
    Object.defineProperty(messages, 'scrollHeight', { value: 800 });
    act(() => screen.getByLabelText('Chat').focus());
    expect(messages.scrollTop).toBe(800);
  });
});
