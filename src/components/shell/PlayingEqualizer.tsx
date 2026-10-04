"use client";

import { EqualizerBars } from "@/components/motion/EqualizerBars";
import { cn } from "@/lib/utils";

/**
 * Equalizer for a track that is really playing. Thin wrapper around the shared
 * EqualizerBars component so every equalizer in the app stays in one place.
 */
export function PlayingEqualizer({ className }: { className?: string }) {
  return (
    <EqualizerBars
      label="Currently playing"
      height={12}
      width={2}
      className={cn("h-4", className)}
    />
  );
}
