'use client';

import { useEffect } from 'react';

export function shouldHideChatChrome(
  focused: boolean,
  touch: boolean,
  width: number,
) {
  return focused && touch && width < 1280;
}

/** Focus is the signal; viewport dimensions only size the available space. */
export function useChatViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;
    const clear = () => {
      root.removeAttribute('data-keyboard-visible');
      root.style.removeProperty('--muse-visual-viewport-top');
      root.style.removeProperty('--muse-visual-viewport-height');
    };
    const update = () => {
      const touch =
        navigator.maxTouchPoints > 0 ||
        !!window.matchMedia?.('(pointer: coarse)').matches;
      const focused = document.activeElement?.id === 'chat-message-input';
      if (!shouldHideChatChrome(focused, touch, window.innerWidth)) {
        clear();
        return;
      }
      root.setAttribute('data-keyboard-visible', 'true');
      if (viewport && viewport.scale === 1) {
        root.style.setProperty(
          '--muse-visual-viewport-top',
          `${Math.max(0, viewport.offsetTop)}px`,
        );
        root.style.setProperty(
          '--muse-visual-viewport-height',
          `${viewport.height}px`,
        );
      }
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const messages = document.querySelector<HTMLElement>(
          '[data-chat-messages]',
        );
        if (messages) messages.scrollTop = messages.scrollHeight;
      });
    };
    document.addEventListener('focusin', update);
    // focusout fires before the browser updates activeElement.
    const blur = () => {
      clear();
    };
    document.addEventListener('focusout', blur);
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    update();
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', blur);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.cancelAnimationFrame(frame);
      clear();
    };
  }, []);
}
