import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockAppApi } from './fixtures';

for (const width of [375, 1440]) {
  for (const theme of ['dark', 'light'] as const) {
    test(`brand at ${width}px in ${theme} theme`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((theme) => {
        localStorage.setItem(
          'muse.ui.prefs.v1',
          JSON.stringify({ theme, lite: 'off' }),
        );
      }, theme);
      await mockAppApi(page, { authenticated: false });
      for (const route of ['/', '/chat']) {
        await page.goto(route);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('html')).toHaveAttribute(
          'data-effects',
          'none',
        );
        await expect(page.getByRole('main')).toBeVisible();
        const accent = await page
          .locator('html')
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue('--color-accent').trim(),
          );
        expect(accent.toUpperCase()).toBe(
          theme === 'dark' ? '#A8E85C' : '#375B0D',
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        const results = await new AxeBuilder({ page })
          .withRules(['color-contrast'])
          .analyze();
        expect(results.violations).toEqual([]);
        await page.screenshot({
          path: testInfo.outputPath(
            `${route === '/' ? 'home' : 'chat'}-${theme}-${width}.png`,
          ),
          fullPage: true,
        });
      }
      await page.goto('/');
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('link', { name: 'Skip to main content' }),
      ).toBeFocused();
      await page.keyboard.press('Tab');
      const ring = await page
        .locator(':focus-visible')
        .evaluate((element) => getComputedStyle(element).outlineColor);
      expect(ring).toBe(
        theme === 'dark' ? 'rgb(168, 232, 92)' : 'rgb(55, 91, 13)',
      );
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.getByRole('button', { name: 'Display settings' }).click();
      await page
        .getByRole('group', { name: 'Lite mode' })
        .getByRole('button', { name: 'On', exact: true })
        .click();
      await expect(page.locator('html')).toHaveAttribute(
        'data-effects',
        'lite',
      );
      await page
        .getByRole('group', { name: 'Theme' })
        .getByRole('button', {
          name: theme === 'dark' ? 'Light' : 'Dark',
          exact: true,
        })
        .click();
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        theme === 'dark' ? 'light' : 'dark',
      );
    });
  }
}
