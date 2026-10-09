'use client';

import * as React from 'react';
import { useEffectsLevel } from '@/hooks/use-ui-prefs';
import { useVibe } from '@/hooks/use-vibe';
import { paletteForVibe, type VibePalette } from '@/lib/vibe-palette';

/**
 * A quiet wash at the top of the page in the colour of the last prompt. A
 * new colour mounts as its own layer that fades in over the old one, then
 * the old one is dropped, so the tint never jumps. Full effects only; Lite
 * and reduced motion render nothing at all.
 */

interface Layer {
  id: number;
  palette: VibePalette;
}

interface Stack {
  key: string;
  layers: Layer[];
}

export function VibeBackdrop() {
  const level = useEffectsLevel();
  const vibe = useVibe();
  const palette = paletteForVibe(vibe);

  const [stack, setStack] = React.useState<Stack>(() => ({
    key: palette.name,
    layers: [{ id: 0, palette }],
  }));

  if (stack.key !== palette.name) {
    const last = stack.layers[stack.layers.length - 1];
    setStack({
      key: palette.name,
      layers: [last, { id: last.id + 1, palette }],
    });
  }

  const settle = React.useCallback(() => {
    setStack((current) =>
      current.layers.length > 1
        ? { key: current.key, layers: current.layers.slice(-1) }
        : current,
    );
  }, []);

  // If the fade never reports its end (hidden tab), settle anyway.
  React.useEffect(() => {
    if (stack.layers.length < 2) return;
    const timer = window.setTimeout(settle, 1600);
    return () => window.clearTimeout(timer);
  }, [settle, stack.layers.length]);

  if (level !== 'full') return null;

  return (
    <div
      aria-hidden="true"
      data-testid="vibe-backdrop"
      data-vibe={palette.name}
      className="muse-vibe-backdrop muse-effect-full"
    >
      {stack.layers.map((layer, index) => (
        <div
          key={layer.id}
          className="muse-vibe-layer"
          data-entering={index > 0 ? 'true' : undefined}
          onAnimationEnd={index > 0 ? settle : undefined}
          style={{ '--vibe-tint': layer.palette.tint } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
