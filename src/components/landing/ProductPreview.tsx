'use client';

import { useEffect, useRef } from 'react';
import { Surface } from '@/components/ui/Surface';
import { Logo } from '@/components/ui/Logo';
import { EqualizerBars } from '@/components/motion/EqualizerBars';
import { CreateInSpotifyButton } from '@/components/playlist/CreateInSpotifyButton';
import { getContextualLoadingMessages } from '@/components/chat/ThinkingIndicator';
import { previewBeatStyle, previewTrackStyle } from '@/lib/preview-timeline';

const PREVIEW_PROMPT = 'I want something like Brent Faiyaz but less sad.';
const PREVIEW_THINKING_LINE = getContextualLoadingMessages(PREVIEW_PROMPT)[0];

const TRACKS = [
  { title: 'Selfish', artist: 'Brent Faiyaz', duration: '3:45' },
  { title: 'Trust', artist: 'Brent Faiyaz', duration: '3:12' },
  { title: 'Dead Man Walking', artist: 'Brent Faiyaz', duration: '3:07' },
];

/**
 * How far below the fold the preview has to start before the scripted sequence
 * is armed. When it is already on screen at load it keeps the finished frame,
 * so the preview never flashes and the first paint is never hidden.
 */
const ARM_MARGIN_PX = 96;

/**
 * The scripted preview: the only simulated sequence in the product. It plays
 * once when it scrolls into view, it is marked aria-hidden with a plain text
 * description alongside, it shows the Create in Spotify control in its idle
 * state only, and it never contacts Spotify or OpenAI.
 */
export function ProductPreview() {
  const frameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    if (typeof IntersectionObserver !== 'function') return;
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    if (node.getBoundingClientRect().top <= window.innerHeight - ARM_MARGIN_PX) {
      return;
    }

    node.dataset.play = 'armed';

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          node.dataset.play = 'playing';
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      delete node.dataset.play;
    };
  }, []);

  return (
    <section
      aria-labelledby="product-preview-heading"
      className="mx-auto max-w-5xl px-6 py-20"
    >
      <h2 id="product-preview-heading" className="sr-only">
        Example MUSE conversation
      </h2>

      <p className="sr-only">
        An example conversation. A listener asks for something like Brent
        Faiyaz but less sad. MUSE thinks for a moment, replies with a short
        recommendation, and shows three example tracks and an example Create in
        Spotify control. Nothing here contacts Spotify or OpenAI and no playlist
        is created.
      </p>

      <Surface
        variant="flat"
        className="flex aspect-video flex-col overflow-hidden border border-border-strong"
      >
        <div
          ref={frameRef}
          className="muse-preview flex min-h-0 flex-1 flex-col"
        >
          <div className="flex items-center justify-between border-b border-border-subtle bg-surface p-4">
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
              <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
              <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
            </div>
            <span className="text-[10px] font-medium uppercase tracking-widest text-text-muted">
              Illustrative preview
            </span>
          </div>

          <div
            aria-hidden="true"
            className="custom-scrollbar flex-1 space-y-8 overflow-y-auto p-6"
          >
            <div
              data-preview-item="prompt"
              style={previewBeatStyle('prompt')}
              className="ml-auto max-w-md"
            >
              <Surface
                variant="flat"
                className="rounded-2xl rounded-tr-none border border-accent/20 bg-accent/10 p-4"
              >
                <p className="text-sm">{PREVIEW_PROMPT}</p>
              </Surface>
            </div>

            <div className="max-w-md space-y-4">
              <div
                data-preview-item="thinking"
                style={previewBeatStyle('thinking')}
                className="flex items-center gap-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border-subtle bg-surface">
                  <Logo variant="mark" size={20} />
                </div>
                <EqualizerBars height={14} width={2} bars={4} />
                <span className="text-xs font-semibold text-text-secondary">
                  {PREVIEW_THINKING_LINE}
                </span>
              </div>

              <div
                data-preview-item="reply"
                style={previewBeatStyle('reply')}
                className="space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border-subtle bg-surface">
                    <Logo variant="mark" size={20} />
                  </div>
                  <span className="text-xs font-semibold text-text-secondary">
                    Example response
                  </span>
                </div>

                <p className="text-sm leading-relaxed text-text-secondary">
                  A sample recommendation layout with example tracks and an
                  example playlist action.
                </p>
              </div>

              <div
                role="list"
                aria-label="Sample recommended tracks"
                className="space-y-1"
              >
                {TRACKS.map((track, index) => (
                  <div
                    key={track.title}
                    role="listitem"
                    data-preview-item="track"
                    style={previewTrackStyle(index)}
                    className="flex items-center gap-4 rounded p-2"
                  >
                    <span className="w-4 shrink-0 text-xs tabular-nums text-text-muted">
                      {index + 1}
                    </span>
                    <div
                      aria-hidden="true"
                      className="h-10 w-10 shrink-0 rounded border border-border-strong bg-surface"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {track.title}
                      </p>
                      <p className="truncate text-xs text-text-muted">
                        {track.artist}
                      </p>
                    </div>
                    <span className="hidden w-10 shrink-0 text-right text-[10px] tabular-nums text-text-muted sm:inline-block">
                      {track.duration}
                    </span>
                  </div>
                ))}
              </div>

              <div
                data-preview-item="action"
                style={previewBeatStyle('action')}
                className="flex flex-col gap-2 rounded-lg border border-border-strong bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <CreateInSpotifyButton
                  name="Late night drive"
                  trackUris={[]}
                  inert
                  size="sm"
                />
                <span className="text-xs text-text-muted">
                  No playlist is created from this preview.
                </span>
              </div>
            </div>
          </div>
        </div>
      </Surface>

      <p className="mt-3 text-xs text-text-muted">
        Illustrative UI only. This preview does not contact Spotify or OpenAI.
      </p>
    </section>
  );
}
