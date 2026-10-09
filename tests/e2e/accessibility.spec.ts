import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockAppApi } from './fixtures';

const auditedRoutes = [
  '/',
  '/chat',
  '/discover',
  '/library',
  '/playlists',
  '/profile',
  '/settings',
];

test('primary routes have no automated WCAG A or AA axe violations', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockAppApi(page);

  const failures: Array<{
    route: string;
    id: string;
    impact: string | null;
    description: string;
    targets: string[];
  }> = [];

  for (const route of auditedRoutes) {
    await page.goto(route);
    await expect(page.getByRole('main')).toBeVisible();
    await page.waitForFunction(() => {
      const pageContent = document.querySelector('main > div[style]');
      return (
        !pageContent ||
        Number.parseFloat(getComputedStyle(pageContent).opacity) >= 0.99
      );
    });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    failures.push(
      ...results.violations.map((violation) => ({
        route,
        id: violation.id,
        impact: violation.impact ?? null,
        description: violation.description,
        targets: violation.nodes.map((node) => node.target.join(', ')),
      })),
    );
  }

  expect(failures).toEqual([]);
});
