import * as React from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PreviewActionStatus } from '@/lib/landing-preview';

/**
 * What sits under a finished list in the real chat, drawn inert for the
 * landing demo: the Copy list and Share actions, then the open-in chips.
 * Nothing here is a button or a link. The status walks copy -> copied ->
 * links shown, which is what a visitor does with a list: keep it, then open
 * a song where they listen. No service is contacted.
 */

export const SAMPLE_OPEN_IN = [
  'Audiomack',
  'Boomplay',
  'Spotify',
  'Apple Music',
] as const;

const CHIP =
  'inline-flex h-8 items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 text-xs font-semibold text-text-primary';

export function SampleListActions({
  status,
  className,
}: {
  status: PreviewActionStatus;
  className?: string;
}) {
  const copyLabel =
    status === 'loading'
      ? 'Copying'
      : status === 'idle'
        ? 'Copy list'
        : 'Copied';

  return (
    <div
      aria-hidden="true"
      data-testid="sample-list-actions"
      data-status={status}
      className={cn('space-y-3', className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            CHIP,
            status === 'success' || status === 'open'
              ? 'border-accent/40 text-accent'
              : undefined,
          )}
        >
          {status === 'success' || status === 'open' ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <Copy size={14} aria-hidden="true" />
          )}
          {copyLabel}
        </span>
        <span className={CHIP}>
          <Share2 size={14} aria-hidden="true" />
          Share
        </span>
      </div>
      <div
        className="flex flex-wrap items-center gap-2 transition-opacity duration-300"
        style={{ opacity: status === 'open' ? 1 : 0 }}
      >
        <span className="text-xs font-medium text-text-muted">Open in</span>
        {SAMPLE_OPEN_IN.map((service) => (
          <span key={service} className={cn(CHIP, 'h-7 px-2.5')}>
            {service}
          </span>
        ))}
      </div>
    </div>
  );
}
