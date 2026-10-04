import { expect, test } from '@playwright/test';
import { mockAppApi } from './fixtures';

test('the landing page starts Spotify OAuth without exposing a credential', async ({
  page,
}) => {
  await mockAppApi(page, { authenticated: false });
  await page.route('https://accounts.spotify.com/authorize**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<main><h1>Mock Spotify authorization</h1></main>',
    }),
  );

  await page.goto('/');
  await page.getByRole('button', { name: 'Connect Spotify' }).click();

  await expect(page).toHaveURL(/accounts\.spotify\.com\/authorize/);
  await expect(
    page.getByRole('heading', { name: 'Mock Spotify authorization' }),
  ).toBeVisible();
});

test('a signed-out visitor is redirected away from a protected screen', async ({
  page,
}) => {
  await mockAppApi(page, { authenticated: false });

  await page.goto('/settings');

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole('button', { name: 'Connect Spotify' }),
  ).toBeVisible();
});
