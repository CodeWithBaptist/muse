/**
 * Text matching for song titles and artist names as a model writes them
 * against the way catalogues list them. Deliberately lenient on featured
 * artists, punctuation, and version suffixes, strict on the core words.
 */

const FEATURE_WORDS = /\b(?:feat\.?|featuring|ft\.?|with)\b/i;
const VERSION_SUFFIX =
  /\s*[([{-]\s*(?:(?:official|original|album|radio|extended|single|clean|explicit|sped up|slowed|remaster(?:ed)?|live|acoustic|remix|version|edit|mix)\b[^)\]}]*)[)\]}]?\s*$/i;

export function normaliseText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc`]/g, "'")
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The title without featured artists or version notes, e.g. "Essence (feat. Tems)" -> "essence". */
export function coreTitle(title: string): string {
  let core = title.trim();
  // Bracketed segment that starts with a feature word.
  core = core.replace(
    /\s*[([{]\s*(?:feat\.?|featuring|ft\.?|with)\b[^)\]}]*[)\]}]/gi,
    '',
  );
  // Trailing "feat. X" with no brackets.
  const featureAt = core.search(FEATURE_WORDS);
  if (featureAt > 0) core = core.slice(0, featureAt);
  for (let i = 0; i < 2; i += 1) core = core.replace(VERSION_SUFFIX, '');
  return normaliseText(core);
}

/** Splits "Wizkid ft. Tems, Justin Bieber" into its separate names. */
export function splitArtists(artist: string): string[] {
  return artist
    .split(
      /\s*(?:,|;|\/|&|\+|\bx\b|\band\b|\bfeat\.?|\bfeaturing\b|\bft\.?|\bwith\b|\bvs\.?)\s*/i,
    )
    .map((part) => normaliseText(part))
    .filter((part) => part.length > 0);
}

export function titleMatches(wanted: string, candidate: string): boolean {
  const a = coreTitle(wanted);
  const b = coreTitle(candidate);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)))
    return true;
  const wordsA = new Set(a.split(' '));
  const wordsB = new Set(b.split(' '));
  if (wordsA.size < 2 || wordsB.size < 2) return false;
  let shared = 0;
  for (const word of wordsA) if (wordsB.has(word)) shared += 1;
  return shared / Math.max(wordsA.size, wordsB.size) >= 0.75;
}

/**
 * True when any artist the model named appears as the catalogue artist or
 * as a feature in the catalogue title. "Tems" matches "Essence (feat. Tems)".
 */
export function artistMatches(
  wanted: string,
  candidateArtist: string,
  candidateTitle = '',
): boolean {
  const haystacks = [
    normaliseText(candidateArtist),
    normaliseText(candidateTitle),
  ];
  const candidateNames = new Set(splitArtists(candidateArtist));
  for (const name of splitArtists(wanted)) {
    if (name.length < 2) continue;
    if (candidateNames.has(name)) return true;
    for (const haystack of haystacks) {
      if (
        haystack &&
        new RegExp(`(?:^| )${escapeRegExp(name)}(?: |$)`).test(haystack)
      )
        return true;
    }
  }
  return false;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
