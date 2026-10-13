'use client';

import * as React from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useMediaQuery } from '@/hooks/use-media-query';
import { usePathname } from 'next/navigation';
import type { ListedTrack } from '@/lib/catalogue/types';
import { openLinksFor } from '@/lib/catalogue/search-links';
import { PlaylistActions } from './PlaylistActions';
import { TrackArt } from './TrackArt';

type Selection = { track: ListedTrack; tracks: ListedTrack[]; title: string };
const TrackDetailsContext = React.createContext({
  selection: null as Selection | null,
  select: (() => {}) as (selection: Selection) => void,
  close: () => {},
});

export function TrackDetailsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [previousPath, setPreviousPath] = React.useState(pathname);
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const close = React.useCallback(() => setSelection(null), []);
  if (previousPath !== pathname) {
    setPreviousPath(pathname);
    setSelection(null);
  }
  return (
    <TrackDetailsContext.Provider
      value={{
        selection,
        select: setSelection,
        close,
      }}
    >
      {children}
    </TrackDetailsContext.Provider>
  );
}

export const useTrackDetails = () => React.useContext(TrackDetailsContext);

function Details({ selection }: { selection: Selection }) {
  const { track, tracks, title } = selection;
  return (
    <div className="space-y-4 p-6">
      <TrackArt
        title={track.title}
        artworkUrl={track.verification?.artworkUrl}
        className="h-auto w-full aspect-square text-4xl"
      />
      <h2 className="text-lg font-bold">{track.title}</h2>
      <p className="text-sm text-text-secondary">{track.artist}</p>
      <p className="text-sm text-text-secondary">Why this: {track.why}</p>
      <p className="text-xs text-text-muted">
        {track.verification?.status === 'verified'
          ? `Verified on ${track.verification.source === 'itunes' ? 'Apple Music' : 'Deezer'}`
          : 'Unverified'}
      </p>
      <nav aria-label="Open in" className="flex flex-wrap gap-3">
        {openLinksFor(track, [
          'audiomack',
          'boomplay',
          'youtube-music',
          'apple-music',
          'deezer',
          'spotify',
        ]).map((link) => (
          <a
            key={link.service}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline focus-ring"
          >
            {link.label}
          </a>
        ))}
      </nav>
      <PlaylistActions title={title} tracks={tracks} />
    </div>
  );
}

export function TrackDetailsPanel() {
  const { selection, close } = useTrackDetails();
  const smallScreen = useMediaQuery('(max-width: 1279px)');
  return (
    <>
      <aside
        aria-label="Track details"
        className="hidden w-[var(--muse-now-playing-width)] shrink-0 overflow-y-auto border-l border-border-subtle bg-background xl:block"
      >
        {selection ? (
          <Details selection={selection} />
        ) : (
          <div className="p-6 text-sm text-text-secondary">
            <h2 className="font-semibold">Track details</h2>
            <p className="mt-2">
              Select a song to see why it fits and where to find it.
            </p>
          </div>
        )}
      </aside>
      <BottomSheet
        open={!!selection && smallScreen}
        onClose={close}
        title="Track details"
      >
        {selection ? <Details selection={selection} /> : null}
      </BottomSheet>
    </>
  );
}
