/**
 * Public search pages for a song on the services people in Nigeria use.
 * These are plain search URLs, not deep links, so they need no API and no
 * login; they also carry no affiliation. Audiomack and Boomplay patterns
 * are the least documented and should be checked on a phone (see docs).
 */

export const SEARCH_SERVICES = [
  'audiomack',
  'boomplay',
  'spotify',
  'apple-music',
  'youtube-music',
  'deezer',
] as const;
export type SearchService = (typeof SEARCH_SERVICES)[number];

export const SEARCH_SERVICE_LABELS: Record<SearchService, string> = {
  audiomack: 'Audiomack',
  boomplay: 'Boomplay',
  spotify: 'Spotify',
  'apple-music': 'Apple Music',
  'youtube-music': 'YouTube Music',
  deezer: 'Deezer',
};

export function searchQueryFor(track: {
  title: string;
  artist: string;
}): string {
  return `${track.artist} ${track.title}`.replace(/\s+/g, ' ').trim();
}

export function searchUrlFor(
  service: SearchService,
  track: { title: string; artist: string },
): string {
  const q = searchQueryFor(track);
  const encoded = encodeURIComponent(q);
  switch (service) {
    case 'audiomack':
      return `https://audiomack.com/search?q=${encoded}`;
    case 'boomplay':
      return `https://www.boomplay.com/search/default/${encoded}`;
    case 'spotify':
      return `https://open.spotify.com/search/${encoded}`;
    case 'apple-music':
      return `https://music.apple.com/ng/search?term=${encoded}`;
    case 'youtube-music':
      return `https://music.youtube.com/search?q=${encoded}`;
    case 'deezer':
      return `https://www.deezer.com/search/${encoded}`;
  }
}

export interface SearchLink {
  service: SearchService;
  label: string;
  url: string;
}

export function searchLinksFor(
  track: { title: string; artist: string },
  services: readonly SearchService[] = SEARCH_SERVICES,
): SearchLink[] {
  return services.map((service) => ({
    service,
    label: SEARCH_SERVICE_LABELS[service],
    url: searchUrlFor(service, track),
  }));
}

/** Services shown first on every track; the ones people in Nigeria reach for. */
export const PROMINENT_SERVICES: readonly SearchService[] = [
  'audiomack',
  'boomplay',
];
export const MORE_SERVICES: readonly SearchService[] = [
  'spotify',
  'apple-music',
  'youtube-music',
  'deezer',
];

export interface OpenLink extends SearchLink {
  /** True when the link goes to the exact catalogue page rather than a search. */
  direct: boolean;
}

/**
 * Open-in links for one track. A verified pick links straight to its Deezer
 * or Apple Music page for that service; every other service gets a search.
 */
export function openLinksFor(
  track: {
    title: string;
    artist: string;
    verification?: {
      status: string;
      source?: 'deezer' | 'itunes';
      url?: string;
    };
  },
  services: readonly SearchService[] = [
    ...PROMINENT_SERVICES,
    ...MORE_SERVICES,
  ],
): OpenLink[] {
  const direct =
    track.verification?.status === 'verified' && track.verification.url
      ? {
          service: (track.verification.source === 'itunes'
            ? 'apple-music'
            : 'deezer') as SearchService,
          url: track.verification.url,
        }
      : null;
  return services.map((service) => {
    if (direct && direct.service === service) {
      return {
        service,
        label: SEARCH_SERVICE_LABELS[service],
        url: direct.url,
        direct: true,
      };
    }
    return {
      service,
      label: SEARCH_SERVICE_LABELS[service],
      url: searchUrlFor(service, track),
      direct: false,
    };
  });
}
