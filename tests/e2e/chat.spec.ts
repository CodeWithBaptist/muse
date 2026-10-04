import { expect, test } from '@playwright/test';
import { mockAppApi, TEST_TRACKS } from './fixtures';

const recommendationEvents = [
  { type: 'status', stage: 'Searching Spotify catalog' },
  { type: 'delta', delta: 'Here are a few late-night picks.' },
  {
    type: 'done',
    conversationId: '11111111-1111-4111-8111-111111111111',
    role: 'assistant',
    content: 'Here are a few late-night picks.',
    tracks: TEST_TRACKS,
  },
];

test('chat streams a response and displays selectable recommendations', async ({
  page,
}) => {
  await mockAppApi(page, {
    chatResponse: { events: recommendationEvents },
  });

  await page.goto('/chat');
  const input = page.getByRole('textbox', { name: 'Message MUSE' });
  await expect(input).toBeVisible();
  await input.fill('Find a spacious late-night neo-soul mix');
  await input.press('Enter');

  await expect(
    page.getByText('Here are a few late-night picks.'),
  ).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Recommended tracks' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Select Cranes in the Sky' }),
  ).toBeVisible();
});

test('chat exposes a recoverable rate-limit error state', async ({ page }) => {
  await mockAppApi(page, {
    chatResponse: {
      status: 429,
      body: {
        error: 'Too many requests in a short window. Wait and try again.',
        code: 'RATE_LIMITED',
      },
    },
  });

  await page.goto('/chat');
  const input = page.getByRole('textbox', { name: 'Message MUSE' });
  await input.fill('Find a new playlist');
  await input.press('Enter');

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Rate limited');
  await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('Discover shows a retry action when recommendations fail to load', async ({
  page,
}) => {
  await mockAppApi(page, { discoverStatus: 503 });

  await page.goto('/discover');

  await expect(
    page.getByRole('heading', { name: 'Unable to curate recommendations right now' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});
