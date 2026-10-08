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
