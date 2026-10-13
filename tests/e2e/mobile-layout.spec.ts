import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockAppApi, TEST_TRACKS } from './fixtures';

const widths = [360, 390, 430, 768, 1024, 1280, 1440];
for (const theme of ['dark', 'light'] as const) {
  for (const width of widths) {
    for (const authenticated of [false, true]) {
      test(`${theme} ${width}px ${authenticated ? 'tester' : 'guest'} shell, sheet and navigation`, async ({
        page,
      }) => {
        await page.addInitScript((theme) => {
          localStorage.setItem(
            'muse.ui.prefs.v1',
            JSON.stringify({ theme, lite: 'on' }),
          );
        }, theme);
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await mockAppApi(page, {
          authenticated,
          spotifyPlaylists: TEST_TRACKS,
        });
        await page.goto('/chat');
        const tabs = page.getByTestId('bottom-tabs');
        const sidebar = page.getByRole('complementary', {
          name: 'Application sidebar',
        });
        if (width < 768) {
          await expect(tabs).toBeVisible();
          await expect(sidebar).toBeHidden();
          await expect(
            tabs.getByRole('link', { name: 'Chat', exact: true }),
          ).toHaveAttribute('aria-current', 'page');
          for (const link of await tabs.getByRole('link').all()) {
            const rect = await link.boundingBox();
            expect(rect!.height).toBeGreaterThanOrEqual(44);
            expect(rect!.width).toBeGreaterThanOrEqual(44);
          }
          await expect(tabs.getByRole('link')).toHaveCount(
            authenticated ? 6 : 2,
          );
          expect(
            (
              await new AxeBuilder({ page })
                .include('.muse-bottom-tabs')
                .analyze()
            ).violations,
          ).toEqual([]);
          const trigger = page.getByRole('button', {
            name: 'Account',
            exact: true,
          });
          await trigger.click();
          const sheet = page.getByRole('dialog', {
            name: 'Account',
            exact: true,
          });
          await expect(sheet).toBeVisible();
          await expect(sheet).toHaveAttribute('aria-modal', 'true');
          await expect(
            sheet.getByText(
              authenticated ? 'Spotify connected' : 'Chat stays on this device',
            ),
          ).toBeVisible();
          await expect(
            sheet.getByRole('button', { name: 'Log out', exact: true }),
          ).toHaveCount(authenticated ? 1 : 0);
          const panel = await sheet.locator('.muse-sheet-panel').boundingBox();
          expect(panel!.height).toBeLessThanOrEqual(900 * 0.85 + 1);
          expect(panel!.x).toBeGreaterThanOrEqual(16);
          expect(panel!.x + panel!.width).toBeLessThanOrEqual(width - 16);
          expect(
            (await new AxeBuilder({ page }).include('.muse-sheet').analyze())
              .violations,
          ).toEqual([]);
          await page.keyboard.press('Escape');
          await expect(sheet).toBeHidden();
          await expect(trigger).toBeFocused();
        } else {
          await expect(tabs).toBeHidden();
          await expect(sidebar).toBeVisible();
          await page.getByRole('button', { name: 'Display settings' }).click();
          const popover = page.getByRole('dialog', {
            name: 'Display settings',
          });
          const rect = await popover.boundingBox();
          expect(rect!.x).toBeGreaterThanOrEqual(16);
          expect(rect!.y).toBeGreaterThanOrEqual(16);
          expect(rect!.x + rect!.width).toBeLessThanOrEqual(width - 16);
          expect(rect!.y + rect!.height).toBeLessThanOrEqual(900 - 16);
          await page.keyboard.press('Escape');
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        if (authenticated) {
          await page.goto('/library');
          await page
            .getByRole('button', {
              name: `Select ${TEST_TRACKS[0].name}`,
              exact: true,
            })
            .first()
            .click();
          if (width < 1280) {
            const sheet = page.getByRole('dialog', { name: 'Track details' });
            await expect(sheet).toBeVisible();
            await expect(
              sheet.getByText(TEST_TRACKS[0].name, { exact: true }),
            ).toBeVisible();
            await expect(
              sheet.getByRole('link', { name: /Spotify/ }).first(),
            ).toBeVisible();
            expect(
              (await new AxeBuilder({ page }).include('.muse-sheet').analyze())
                .violations,
            ).toEqual([]);
            await sheet
              .getByRole('button', { name: 'Close track details' })
              .click();
            const strip = page.getByTestId('now-playing-strip');
            await expect(strip).toBeVisible();
            const main = await page.getByRole('main').boundingBox();
            const bar = await strip.boundingBox();
            expect(main!.y + main!.height).toBeLessThanOrEqual(bar!.y + 1);
            await strip
              .getByRole('button', {
                name: `Show details for ${TEST_TRACKS[0].name}`,
              })
              .click();
            await expect(sheet).toBeVisible();
            await page.keyboard.press('Escape');
          } else {
            await expect(
              page.getByRole('dialog', { name: 'Track details' }),
            ).toBeHidden();
            await expect(page.getByTestId('now-playing-panel')).toBeVisible();
            await expect(page.getByTestId('now-playing-strip')).toBeHidden();
          }
        }
      });
    }
  }
}
