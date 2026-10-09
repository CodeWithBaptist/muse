'use client';

import * as React from 'react';
import { ListMusic } from 'lucide-react';
import { beatEnvelope, beatSeconds, subscribeBeat } from '@/lib/beat-clock';
import { useEffectsLevel } from '@/hooks/use-ui-prefs';
import { cn } from '@/lib/utils';

/**
 * Bars that pulse to the shared 96 BPM beat clock, for a playlist header.
 * Each bar follows the beat envelope through its own phase and a slow swell,
 * so they look like a level meter without pretending to measure any audio.
 * Only subscribes while on screen and under full effects; otherwise it is
 * the plain list icon. Decorative, so hidden from assistive technology.
 */

const PHASES = [0.0, 0.37, 0.71, 0.19, 0.55, 0.88, 0.26];
const FLOORS = [0.28, 0.42, 0.34, 0.5, 0.38, 0.45, 0.3];

export interface BeatVisualizerProps {
  bars?: number;
  className?: string;
}

export function BeatVisualizer({ bars = 5, className }: BeatVisualizerProps) {
  const level = useEffectsLevel();
  const rootRef = React.useRef<HTMLSpanElement>(null);
  const barRefs = React.useRef<Array<HTMLSpanElement | null>>([]);
  const [visible, setVisible] = React.useState(false);
  const live = level === 'full';

  React.useEffect(() => {
    if (!live) return;
    const root = rootRef.current;
    if (!root) return;
    if (typeof IntersectionObserver === 'undefined') {
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        setVisible(entries.some((entry) => entry.isIntersecting));
      },
      { threshold: 0 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [live]);

  React.useEffect(() => {
    if (!live || !visible) return;
    return subscribeBeat((nowMs) => {
      const envelope = beatEnvelope(nowMs);
      const seconds = beatSeconds(nowMs);
      for (let index = 0; index < bars; index += 1) {
        const bar = barRefs.current[index];
        if (!bar) continue;
        const phase = PHASES[index % PHASES.length];
        const floor = FLOORS[index % FLOORS.length];
        const swell = 0.5 + 0.5 * Math.sin((seconds + phase * 4) * 1.7);
        const scale =
          floor +
          (1 - floor) * Math.max(envelope * (0.55 + 0.45 * swell), swell * 0.3);
        bar.style.transform = `scaleY(${scale.toFixed(3)})`;
      }
    });
  }, [bars, live, visible]);

  if (!live) {
    return (
      <span
        className={cn('inline-flex items-center justify-center', className)}
        aria-hidden="true"
        data-testid="beat-visualizer-static"
      >
        <ListMusic size={18} className="text-accent" />
      </span>
    );
  }

  return (
    <span
      ref={rootRef}
      aria-hidden="true"
      data-testid="beat-visualizer"
      data-live={visible ? 'true' : 'false'}
      className={cn('inline-flex h-5 items-end gap-[3px]', className)}
    >
      {Array.from({ length: bars }).map((_, index) => (
        <span
          key={index}
          ref={(node) => {
            barRefs.current[index] = node;
          }}
          className="muse-beat-bar block h-full w-[3px] origin-bottom rounded-full bg-accent"
          style={{ transform: `scaleY(${FLOORS[index % FLOORS.length]})` }}
        />
      ))}
    </span>
  );
}
