'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Surface } from '@/components/ui/Surface';
import { transitions } from '@/lib/motion';
import { Logo } from '@/components/ui/Logo';

const TRACKS = [
  { title: 'Selfish', artist: 'Brent Faiyaz', duration: '3:45' },
  { title: 'Trust', artist: 'Brent Faiyaz', duration: '3:12' },
  { title: 'Dead Man Walking', artist: 'Brent Faiyaz', duration: '3:07' },
];

export function ProductPreview() {
  const shouldReduceMotion = useReducedMotion() ?? false;

  return (
    <section
      aria-labelledby="product-preview-heading"
      className="mx-auto max-w-5xl px-6 py-20"
    >
      <h2 id="product-preview-heading" className="sr-only">
        Example MUSE conversation
      </h2>
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={shouldReduceMotion ? { duration: 0 } : transitions.standard}
      >
        <Surface
          variant="raised"
          className="flex aspect-video flex-col overflow-hidden border-border-strong"
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

          <div className="custom-scrollbar flex-1 space-y-8 overflow-y-auto p-6">
            <div className="ml-auto max-w-md">
              <Surface
                variant="flat"
                className="rounded-2xl rounded-tr-none border border-accent/20 bg-accent/10 p-4"
              >
                <p className="text-sm">
                  I want something like Brent Faiyaz but less sad.
                </p>
              </Surface>
            </div>

            <div className="max-w-md space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border-subtle bg-surface">
                  <Logo variant="mark" size={20} />
                </div>
                <span className="text-xs font-semibold text-text-secondary">
                  Example response
                </span>
              </div>

              <p className="text-sm leading-relaxed text-text-secondary">
                A sample recommendation layout with track links and an optional
                playlist action.
              </p>

              <div role="list" aria-label="Sample recommended tracks" className="space-y-1">
                {TRACKS.map((track) => (
                  <div
                    key={track.title}
                    role="listitem"
                    className="group flex items-center gap-4 rounded p-2 transition-colors hover:bg-surface"
                  >
                    <div
                      aria-hidden="true"
                      className="h-10 w-10 shrink-0 rounded bg-border-strong"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {track.title}
                      </p>
                      <p className="truncate text-xs text-text-muted">
                        {track.artist}
                      </p>
                    </div>
                    <span className="text-[10px] tabular-nums text-text-muted">
                      {track.duration}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-border-strong bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium">
                  Example playlist action
                </p>
                <span className="text-xs text-text-muted">
                  No playlist is created from this preview.
                </span>
              </div>
            </div>
          </div>
        </Surface>
      </motion.div>
      <p className="mt-3 text-xs text-text-muted">
        Illustrative UI only. This preview does not contact Spotify or OpenAI.
      </p>
    </section>
  );
}
