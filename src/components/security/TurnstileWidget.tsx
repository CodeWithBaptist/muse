'use client';

import * as React from 'react';
import { TURNSTILE_SCRIPT_URL } from '@/lib/security/turnstile-shared';

/**
 * Renders a Cloudflare Turnstile challenge and reports its token.
 *
 * The script is loaded only when the widget is actually shown, so visitors
 * who never hit the human check download nothing extra. Appearance is
 * "interaction-only": most people see nothing, a few see a checkbox.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          appearance?: 'always' | 'execute' | 'interaction-only';
          size?: 'normal' | 'compact' | 'flexible';
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${TURNSTILE_SCRIPT_URL}?render=explicit`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Turnstile script failed to load'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface TurnstileWidgetProps {
  siteKey: string;
  onToken: (token: string) => void;
  onError?: () => void;
  className?: string;
}

export function TurnstileWidget({
  siteKey,
  onToken,
  onError,
  className,
}: TurnstileWidgetProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const onTokenRef = React.useRef(onToken);
  const onErrorRef = React.useRef(onError);

  // Keep the latest callbacks without re-rendering the widget for each change.
  React.useEffect(() => {
    onTokenRef.current = onToken;
    onErrorRef.current = onError;
  }, [onToken, onError]);

  React.useEffect(() => {
    let widgetId: string | null = null;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'dark',
          appearance: 'interaction-only',
          size: 'flexible',
          callback: (token) => onTokenRef.current(token),
          'error-callback': () => onErrorRef.current?.(),
          'expired-callback': () => {
            if (widgetId) window.turnstile?.reset(widgetId);
          },
        });
      })
      .catch(() => onErrorRef.current?.());

    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [siteKey]);

  return (
    <div
      ref={containerRef}
      className={className}
      data-turnstile-widget
      aria-label="Human verification"
    />
  );
}
