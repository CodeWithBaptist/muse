import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The normal visitor's path must never depend on a Spotify token. This test
 * walks the import graph from the open entry points and fails if anything
 * on it reaches the Spotify client, the token store, or the tester gate.
 */

const ROOT = resolve(__dirname, '..');
const ENTRY_POINTS = [
  'app/api/chat/route.ts',
  'app/api/chat/open-chat.ts',
  'lib/ai/playlist-engine.ts',
  'lib/ai/muse-prompt.ts',
  'lib/catalogue/index.ts',
  'lib/playlist-text.ts',
  'components/chat/RecommendationList.tsx',
  'components/chat/PlaylistActions.tsx',
  'components/chat/TrackLinks.tsx',
  'components/chat/VibeChips.tsx',
  'components/chat/ChatPreferenceControls.tsx',
  'components/landing/StartAction.tsx',
  'app/api/human/route.ts',
  'app/api/taste/lastfm/route.ts',
  'app/api/taste/insights/route.ts',
  'lib/ai/taste-insights.ts',
  'lib/taste/read-export.ts',
  'hooks/use-taste.ts',
  'hooks/use-chat.ts',
  'components/profile/ProfileView.tsx',
  'components/chat/TasteHint.tsx',
  'app/(app)/profile/page.tsx',
];
const FORBIDDEN = [
  'lib/spotify.ts',
  'lib/spotify-tokens.ts',
  'lib/spotify-service.ts',
  'lib/playlist-export.ts',
  'lib/testers.ts',
];

function resolveImport(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = resolve(ROOT, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(from), specifier);
  else return null;
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ]) {
    try {
      readFileSync(candidate);
      return candidate;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function importGraph(entry: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const source = readFileSync(entry, 'utf8');
  const specifiers = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(
    (m) => m[1],
  );
  for (const specifier of specifiers) {
    const target = resolveImport(entry, specifier);
    if (target && !target.includes('/node_modules/')) importGraph(target, seen);
  }
  return seen;
}

describe('the no-account path', () => {
  it('walks real imports (so a silent resolver failure cannot pass this file)', () => {
    const graph = importGraph(resolve(ROOT, 'app/api/chat/open-chat.ts'));
    const names = [...graph].map((file) => file.slice(ROOT.length + 1));
    expect(names).toContain('lib/ai/provider.ts');
    expect(names).toContain('lib/catalogue/verify.ts');
    expect(names).toContain('lib/ai/muse-prompt.ts');
  });

  it('never imports the Spotify client, token store, export, or tester gate', () => {
    for (const entry of ENTRY_POINTS) {
      const graph = importGraph(resolve(ROOT, entry));
      const offending = [...graph].filter((file) =>
        FORBIDDEN.some((name) => file.endsWith(`/${name}`)),
      );
      expect(offending, `${entry} reaches ${offending.join(', ')}`).toEqual([]);
    }
  });
});
