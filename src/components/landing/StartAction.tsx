import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * The primary landing action, shared by the header, the hero, and the closing
 * band. It opens the chat for everyone: no account, no Spotify, nothing to
 * configure on the server, so it is a plain link that works before any
 * JavaScript runs.
 */
export const START_ACTION_LABEL = 'Start';
export const START_ACTION_HREF = '/chat';

export interface StartActionProps {
  /** Attribute that lifts the nearby canvas on hover, focus, and touch. */
  actionAttribute?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function StartAction({
  actionAttribute,
  size = 'md',
  className,
}: StartActionProps) {
  const marker: Record<string, string> = actionAttribute
    ? { [actionAttribute]: '' }
    : {};

  return (
    <Link
      href={START_ACTION_HREF}
      {...marker}
      data-start-action
      className={cn(
        'inline-flex items-center justify-center rounded-md bg-accent font-semibold text-background transition-colors hover:bg-accent/90 focus-ring',
        size === 'sm' ? 'h-9 px-4 text-xs' : 'h-11 px-6 text-sm',
        className,
      )}
    >
      {START_ACTION_LABEL}
    </Link>
  );
}
