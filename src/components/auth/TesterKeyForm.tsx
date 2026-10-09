'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/**
 * Where a tester enters the shared key once. A correct key sets the tester
 * pass cookie on the server and the page re-renders with the Spotify
 * sign-in; a wrong key says so and nothing else changes.
 */
export function TesterKeyForm({ className }: { className?: string }) {
  const router = useRouter();
  const inputId = React.useId();
  const errorId = React.useId();
  const [key, setKey] = React.useState('');
  const [status, setStatus] = React.useState<'idle' | 'checking' | 'error'>(
    'idle',
  );
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!key.trim()) return;
    setStatus('checking');
    setError(null);
    try {
      const response = await fetch('/api/tester', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (response.ok) {
        router.refresh();
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? 'That tester key is not right.');
      setStatus('error');
    } catch {
      setError('Could not reach MUSE to check the key. Try again.');
      setStatus('error');
    }
  };

  return (
    <form
      onSubmit={submit}
      className={className}
      aria-label="Tester access"
      data-testid="tester-key-form"
    >
      <label htmlFor={inputId} className="type-section-label block pb-2">
        Tester key
      </label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          type="password"
          autoComplete="off"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder="Paste the key you were given"
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          className="flex-1"
        />
        <Button
          type="submit"
          variant="secondary"
          size="md"
          disabled={status === 'checking' || !key.trim()}
        >
          {status === 'checking' ? 'Checking' : 'Continue'}
        </Button>
      </div>
      <p id={errorId} role="alert" className="min-h-5 pt-2 text-sm text-danger">
        {error ?? ''}
      </p>
    </form>
  );
}
