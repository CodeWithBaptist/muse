'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { EqualizerBars } from '@/components/motion/EqualizerBars';
import { cn } from '@/lib/utils';
import { durations, easings, layerFade } from '@/lib/motion';
import {
  useCreateInSpotify,
  type CreateInSpotifyRequestMode,
} from '@/hooks/use-create-in-spotify';
import {
  CREATE_IN_SPOTIFY_LABELS,
  createInSpotifyAnnouncement,
  createInSpotifyLabel,
  createInSpotifyMessage,
  type CreateInSpotifyState,
  type PlaylistExportFetcher,
  type PlaylistExportRequest,
  type PlaylistExportResult,
  type PlaylistExportTrackMeta,
} from '@/lib/playlist-export';

const SIZE_CLASSES = {
  sm: 'h-9 px-4 text-xs',
  md: 'h-11 px-6 text-sm',
} as const;

const BASE_CLASSES =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.98] focus-ring';

const VARIANT_CLASSES = {
  primary: 'bg-accent-primary text-accent-contrast hover:bg-accent-primary/90',
  outline: 'border border-border-strong text-text-primary hover:bg-surface',
  danger: 'border border-danger/50 text-danger',
} as const;

export interface CreateInSpotifyButtonProps {
  name: string;
  description?: string;
  trackUris: string[];
  tracks?: PlaylistExportTrackMeta[];
  /** MUSE playlist row id, when the export should update a saved draft. */
  playlistId?: string;
  /** Controlled state. When provided the button never runs a request itself. */
  state?: CreateInSpotifyState;
  /** Mirrors internal state changes, for parents that want to observe them. */
  onStateChange?: (state: CreateInSpotifyState) => void;
  onResult?: (result: PlaylistExportResult) => void;
  /** Injectable export request, used by tests. */
  request?: PlaylistExportFetcher;
  /** Renders the visuals without any interactive control, for the demo. */
  inert?: boolean;
  disabled?: boolean;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

/**
 * The shared Create in Spotify control: idle, loading, success, full failure,
 * partial failure, and open. Every state comes from a real export result, the
 * layers cross fade with a 10px offset, and the control keeps a fixed width.
 */
export function CreateInSpotifyButton({
  name,
  description,
  trackUris,
  tracks,
  playlistId,
  state: controlledState,
  onStateChange,
  onResult,
  request,
  inert = false,
  disabled = false,
  size = 'md',
  className,
}: CreateInSpotifyButtonProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;

  const buildRequest = React.useCallback(
    (mode: CreateInSpotifyRequestMode): PlaylistExportRequest | null => {
      if (mode.retryingFailedOnly && mode.failedTrackUris.length > 0) {
        return {
          name,
          description,
          playlistId,
          trackUris: mode.failedTrackUris,
          spotifyPlaylistId: mode.spotifyPlaylistId ?? undefined,
        };
      }

      if (trackUris.length === 0) return null;

      return {
        name,
        description,
        playlistId,
        trackUris,
        tracks,
      };
    },
    [description, name, playlistId, trackUris, tracks],
  );

  const {
    state: internalState,
    create,
    retry,
  } = useCreateInSpotify({
    buildRequest,
    request,
    onResult,
  });

  const state = controlledState ?? internalState;

  const onStateChangeRef = React.useRef(onStateChange);
  React.useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);
  React.useEffect(() => {
    onStateChangeRef.current?.(internalState);
  }, [internalState]);

  const handleCreate = React.useCallback(() => {
    if (controlledState) return;
    create();
  }, [controlledState, create]);

  const handleRetry = React.useCallback(() => {
    if (controlledState) return;
    retry();
  }, [controlledState, retry]);

  const sizeClasses = SIZE_CLASSES[size];
  const label = createInSpotifyLabel(state);
  const message = createInSpotifyMessage(state);
  const announcement = createInSpotifyAnnouncement(state);
  const showRetry = state.status === 'error' || state.status === 'partial';
  const showOpenLink =
    (state.status === 'partial' || state.status === 'error') &&
    Boolean(state.spotifyUrl);
  const busy = state.status === 'loading';

  const layerMotion = {
    initial: 'initial',
    animate: 'animate',
    exit: 'exit',
    variants: layerFade,
    transition: shouldReduceMotion
      ? { duration: 0 }
      : { duration: durations.layer, ease: easings.emphasized },
    className: 'col-start-1 row-start-1 grid',
  } as const;

  const renderPrimary = () => {
    switch (state.status) {
      case 'idle':
        return (
          <button
            type="button"
            data-testid="create-in-spotify-primary"
            onClick={handleCreate}
            disabled={disabled || inert}
            tabIndex={inert ? -1 : undefined}
            aria-hidden={inert ? true : undefined}
            className={cn(
              BASE_CLASSES,
              sizeClasses,
              VARIANT_CLASSES.primary,
              'disabled:opacity-100',
            )}
          >
            {label}
          </button>
        );

      case 'loading':
        return (
          <button
            type="button"
            data-testid="create-in-spotify-primary"
            disabled
            aria-disabled="true"
            aria-hidden={inert ? true : undefined}
            tabIndex={inert ? -1 : undefined}
            className={cn(
              BASE_CLASSES,
              sizeClasses,
              VARIANT_CLASSES.primary,
              'cursor-default disabled:opacity-100',
            )}
          >
            <EqualizerBars tone="dark" height={13} width={2} />
            {label}
          </button>
        );

      case 'success':
        return (
          <span
            data-testid="create-in-spotify-primary"
            data-success="true"
            aria-hidden={inert ? true : undefined}
            className={cn(BASE_CLASSES, sizeClasses, VARIANT_CLASSES.primary)}
          >
            <CheckMark reducedMotion={shouldReduceMotion} />
            {label}
          </span>
        );

      case 'open':
        if (!state.spotifyUrl) return null;
        return (
          <OpenLink
            href={state.spotifyUrl}
            inert={inert}
            testId="create-in-spotify-primary"
            className={cn(BASE_CLASSES, sizeClasses, VARIANT_CLASSES.outline)}
          >
            {label}
          </OpenLink>
        );

      case 'error':
      case 'partial':
        return (
          <span
            data-testid="create-in-spotify-primary"
            data-status={state.status}
            className={cn(
              BASE_CLASSES,
              sizeClasses,
              VARIANT_CLASSES.danger,
              'cursor-default',
            )}
          >
            {message}
          </span>
        );
    }
  };

  return (
    <div
      data-testid="create-in-spotify"
      data-status={state.status}
      className={cn('inline-flex flex-wrap items-center gap-2', className)}
    >
      <span className="grid min-w-fit flex-1">
        {CREATE_IN_SPOTIFY_LABELS.map((sizerLabel) => (
          <span
            key={sizerLabel}
            data-testid="create-in-spotify-sizer"
            aria-hidden="true"
            className={cn(
              'invisible col-start-1 row-start-1',
              BASE_CLASSES,
              sizeClasses,
            )}
          >
            {sizerLabel}
          </span>
        ))}
        <AnimatePresence initial={false} mode="sync">
          <motion.span
            key={state.status}
            data-testid="create-in-spotify-layer"
            data-status={state.status}
            {...layerMotion}
          >
            {renderPrimary()}
          </motion.span>
        </AnimatePresence>
      </span>

      {showRetry && (
        <button
          type="button"
          data-testid="create-in-spotify-retry"
          onClick={handleRetry}
          disabled={busy || inert}
          tabIndex={inert ? -1 : undefined}
          aria-hidden={inert ? true : undefined}
          aria-label={
            state.status === 'partial'
              ? 'Try again to add the missing tracks'
              : 'Try again to create the playlist'
          }
          className={cn(
            BASE_CLASSES,
            sizeClasses,
            VARIANT_CLASSES.outline,
            'w-auto',
          )}
        >
          Try again
        </button>
      )}

      {showOpenLink && (
        <OpenLink
          href={state.spotifyUrl}
          inert={inert}
          testId="create-in-spotify-open"
          className={cn(BASE_CLASSES, sizeClasses, VARIANT_CLASSES.outline)}
        >
          Open in Spotify
        </OpenLink>
      )}

      <span
        data-testid="create-in-spotify-status"
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {announcement}
      </span>

      {showRetry && message && (
        <span
          data-testid="create-in-spotify-alert"
          role="alert"
          aria-live="assertive"
          className="sr-only"
        >
          {message}
        </span>
      )}
    </div>
  );
}

interface OpenLinkProps {
  href: string | null;
  inert?: boolean;
  testId: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Renders the real Spotify link, or a non-interactive stand-in when the control
 * is inert (the landing demo), so nothing focusable or fake is exposed.
 */
function OpenLink({
  href,
  inert = false,
  testId,
  className,
  children,
}: OpenLinkProps) {
  if (inert || !href) {
    return (
      <span
        data-testid={testId}
        aria-hidden={inert ? true : undefined}
        className={className}
      >
        {children}
      </span>
    );
  }
  return (
    <a
      data-testid={testId}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

function CheckMark({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className="shrink-0"
    >
      <path
        d="M2.5 7.5L5.5 10.5L11.5 3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={reducedMotion ? undefined : 'muse-check-path'}
      />
    </svg>
  );
}
