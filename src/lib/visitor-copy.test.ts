// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import {
  CHAT_UNAVAILABLE,
  DISCOVER_UNAVAILABLE,
  visitorMessage,
} from './visitor-copy';

const envPattern = /\b[A-Z][A-Z0-9]*_(KEY|SECRET|URL|ID|TOKEN)\b/;
const multiPartEnvPattern = /\b[A-Z][A-Z0-9_]*_(KEY|SECRET|URL|ID|TOKEN)\b/;
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(directory, entry.name))
      : [join(directory, entry.name)],
  );
}
describe('visitor configuration copy guard', () => {
  it('keeps environment names, files and dashboards out of JSX visitor copy', () => {
    for (const file of [...files('src/app'), ...files('src/components')].filter(
      (file) => file.endsWith('.tsx') && !file.includes('.test.'),
    )) {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      function inspect(node: ts.Node, inJsx = false) {
        const jsx =
          inJsx || ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node);
        if (
          ts.isJsxText(node) ||
          (jsx &&
            (ts.isStringLiteral(node) ||
              ts.isNoSubstitutionTemplateLiteral(node)))
        ) {
          const text = node.text;
          expect(text, file).not.toMatch(envPattern);
          expect(text, file).not.toMatch(multiPartEnvPattern);
          expect(text, file).not.toMatch(
            /\.env(?:\.local)?|environment variables?|Vercel dashboard/i,
          );
        }
        ts.forEachChild(node, (child) => inspect(child, jsx));
      }
      inspect(source);
    }
  });
  it.each([
    'Set API_KEY now',
    'Missing OPENAI_API_KEY',
    'DATABASE_URL failed',
    'See .env.local',
    'Use the Vercel dashboard',
    'Set environment variables',
  ])('redacts legacy operational error copy: %s', (text) => {
    expect(visitorMessage(text)).toBe(CHAT_UNAVAILABLE);
    expect(visitorMessage(text, DISCOVER_UNAVAILABLE)).toBe(
      DISCOVER_UNAVAILABLE,
    );
  });
  it('keeps legitimate connection and rate-limit messages', () => {
    expect(visitorMessage('Reconnect Spotify to continue.')).toBe(
      'Reconnect Spotify to continue.',
    );
    expect(visitorMessage('Too many requests. Try again soon.')).toBe(
      'Too many requests. Try again soon.',
    );
    expect(visitorMessage(null)).toBe(CHAT_UNAVAILABLE);
    expect(CHAT_UNAVAILABLE).not.toMatch(envPattern);
    expect(DISCOVER_UNAVAILABLE).not.toMatch(envPattern);
  });
});
