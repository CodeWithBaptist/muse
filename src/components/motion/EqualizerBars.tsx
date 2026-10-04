'use client';

import * as React from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

/**
 * Equalizer bars shared by the chat thinking indicator, the Create in Spotify
 * button, and playing track rows. The bars only move while something is really
 * loading or playing: `playing={false}` freezes them through
 * `animation-play-state`, and reduced motion renders them static.
 *
 * Transform only (scaleY), so the browser can composite the animation.
 */

const BAR_RATIOS = [0.55, 1, 0.72, 0.88, 0.62];
const STATIC_SCALES = [0.5, 0.82, 0.62, 0.74, 0.56];

export interface EqualizerBarsProps {
  bars?: number;
  tone?: 'lime' | 'dark';
  /** Height of the tallest bar in pixels. */
  height?: number;
  /** Bar width in pixels. */
  width?: number;
  /** False freezes the bars in place instead of animating them. */
  playing?: boolean;
  /** When set, the equalizer is exposed as an image with this label. */
  label?: string;
  durationMs?: number;
  className?: string;
}

export function EqualizerBars({
  bars = 3,
  tone = 'lime',
  height = 14,
  width = 2,
  playing = true,
  label,
  durationMs = 900,
  className,
}: EqualizerBarsProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;

  return (
    <span
      data-testid="equalizer"
      data-paused={playing ? 'false' : 'true'}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('muse-equalizer inline-flex items-end gap-[2px]', className)}
    >
      {Array.from({ length: bars }).map((_, index) => {
        const ratio = BAR_RATIOS[index % BAR_RATIOS.length];
        const staticScale = STATIC_SCALES[index % STATIC_SCALES.length];
        return (
          <span
            key={index}
            data-testid="equalizer-bar"
            className={cn(
              'muse-equalizer-bar rounded-full',
              tone === 'lime' ? 'bg-accent' : 'bg-background',
            )}
            style={
              {
                width,
                height: Math.max(4, Math.round(height * ratio)),
                animationDuration: `${durationMs}ms`,
                // Negative delays start each bar out of phase immediately.
                animationDelay: `${-index * 130}ms`,
                // Only used by the reduced motion rule, and always rendered so
                // the server and client markup stay identical.
                '--muse-equalizer-static-scale': staticScale,
              } as React.CSSProperties
            }
          />
        );
      })}
    </span>
  );
}
