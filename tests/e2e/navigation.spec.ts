import { expect, test } from '@playwright/test';
import { mockAppApi } from './fixtures';

test('primary navigation changes routes and marks the active page', async ({
  page,
}) => {
  await mockAppApi(page);
  await page.goto('/chat');

  const navigation = page.getByRole('navigation', {
    name: 'Primary navigation',
  });
  await expect(navigation).toBeVisible();
  await navigation.getByRole('link', { name: 'Discover' }).click();

  await expect(page).toHaveURL(/\/discover$/);
  await expect(
    page.getByRole('heading', { name: 'Discover', level: 1 }),
  ).toBeVisible();
  await expect(
    navigation.getByRole('link', { name: 'Discover' }),
  ).toHaveAttribute('aria-current', 'page');
});

test('mobile navigation supports focus, Escape, and a narrow viewport', async ({
  page,
}) => {
  await mockAppApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/chat');

  const openButton = page.getByRole('button', { name: 'Open navigation menu' });
  await expect(openButton).toBeVisible();
  await openButton.click();

  const mobileNavigation = page.getByRole('navigation', {
    name: 'Mobile navigation',
  });
  await expect(mobileNavigation).toBeVisible();
  await expect(mobileNavigation.getByRole('link', { name: 'Chat' })).toBeFocused();
  await expect(
    page.getByRole('button', { name: 'Close navigation menu' }),
  ).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Escape');
  await expect(mobileNavigation).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Open navigation menu' }),
  ).toBeFocused();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test('the skip link receives first focus and moves focus to main content', async ({
  page,
}) => {
  await mockAppApi(page);
  await page.goto('/chat');

  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await page.keyboard.press('Tab');
  await expect(skipLink).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('reduced-motion preference avoids smooth page scrolling', async ({ page }) => {
  await mockAppApi(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const reducedMotion = await page.evaluate(() => ({
    matches: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
  }));

  expect(reducedMotion.matches).toBe(true);
  expect(reducedMotion.scrollBehavior).toBe('auto');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
