'use client';

import * as React from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MORE_SERVICES,
  openLinksFor,
  PROMINENT_SERVICES,
  type OpenLink,
} from '@/lib/catalogue/search-links';
import type { ListedTrack } from '@/lib/catalogue/types';

/**
 * Open-in links for one song. Audiomack and Boomplay are always visible;
 * the other four sit behind a small toggle so a twelve-song list does not
 * become seventy links on a phone. Verified picks open the exact catalogue
 * page where one exists; everything else is a public search.
 */

function LinkChip({
  link,
  track,
  prominent,
}: {
  link: OpenLink;
  track: ListedTrack;
  prominent?: boolean;
}) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      data-open-in={link.service}
      data-direct={link.direct ? 'true' : undefined}
      aria-label={`${link.direct ? 'Open' : 'Search for'} ${track.title} by ${track.artist} on ${link.label}`}
      className={cn(
        'inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition-colors focus-ring',
        prominent
          ? 'border-accent/40 bg-accent/10 text-text-primary hover:bg-accent/20'
          : 'border-border-subtle text-text-secondary hover:border-border-strong hover:text-text-primary',
      )}
    >
      {link.label}
      <ExternalLink size={11} aria-hidden="true" className="opacity-60" />
    </a>
  );
}

export function TrackLinks({
  track,
  className,
}: {
  track: ListedTrack;
  className?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const moreId = React.useId();
  const prominent = openLinksFor(track, PROMINENT_SERVICES);
  const more = expanded ? openLinksFor(track, MORE_SERVICES) : [];

  return (
    <div
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      data-testid="track-links"
    >
      <span className="sr-only">Open in</span>
      {prominent.map((link) => (
        <LinkChip key={link.service} link={link} track={track} prominent />
      ))}
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={moreId}
        onClick={() => setExpanded((value) => !value)}
        className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-text-muted transition-colors hover:text-text-primary focus-ring"
      >
        {expanded ? 'Fewer' : 'More'}
        <ChevronDown
          size={12}
          aria-hidden="true"
          className={cn('transition-transform', expanded && 'rotate-180')}
        />
      </button>
      <span id={moreId} className="contents">
        {more.map((link) => (
          <LinkChip key={link.service} link={link} track={track} />
        ))}
      </span>
    </div>
  );
}
