'use client';

import * as React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { TurnstileWidget } from './TurnstileWidget';

/**
 * Shown when an AI route answers HUMAN_CHECK_REQUIRED. Fetches the site key
 * at runtime (so a key added after the build still works), runs the
 * Turnstile widget, trades the token for the human pass cookie, and then
 * hands control back so the message that was blocked can be retried.
 */
export function HumanCheckCard({ onVerified }: { onVerified: () => void }) {
  const [state, setState] = React.useState<'idle' | 'verifying' | 'failed'>(
    'idle',
  );
  const [attempt, setAttempt] = React.useState(0);

  const config = useQuery({
    queryKey: ['human-check-config'],
    queryFn: async () => {
      const res = await fetch('/api/human', { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not load the human check.');
      return (await res.json()) as { enabled: boolean; siteKey: string | null };
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const submit = async (token: string) => {
    setState('verifying');
    try {
      const res = await fetch('/api/human', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error('rejected');
      onVerified();
    } catch {
      setState('failed');
    }
  };

  return (
    <Surface
      role="status"
      aria-live="polite"
      data-testid="chat-human-check"
      className="flex flex-col gap-4 rounded-xl border-border-strong bg-surface p-6"
    >
      <div className="flex items-start gap-4">
        <ShieldCheck
          className="mt-0.5 shrink-0 text-accent"
          size={20}
          aria-hidden="true"
        />
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-text-primary">
            Quick check before MUSE answers
          </h3>
          <p className="text-sm leading-relaxed text-text-secondary">
            {state === 'failed'
              ? 'That check did not go through. Try once more.'
              : state === 'verifying'
                ? 'Confirming...'
                : 'This keeps MUSE free for people, not scripts. It usually completes on its own.'}
          </p>
        </div>
      </div>

      {config.isLoading ? null : config.data?.enabled && config.data.siteKey ? (
        <TurnstileWidget
          key={attempt}
          siteKey={config.data.siteKey}
          onToken={(token) => void submit(token)}
          onError={() => setState('failed')}
          className="min-h-[65px]"
        />
      ) : (
        <p className="text-sm text-text-secondary">
          Human verification is not available right now. Please try again in a
          moment.
        </p>
      )}

      {state === 'failed' ? (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setState('idle');
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
        </div>
      ) : null}
    </Surface>
  );
}
