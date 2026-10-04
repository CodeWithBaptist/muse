import { expect, test } from '@playwright/test';
import { mockAppApi, TEST_TRACKS } from './fixtures';

test('a playlist recommendation can be saved to MUSE and exported to Spotify', async ({
  page,
}) => {
  await mockAppApi(page, {
    chatResponse: {
      events: [
        { type: 'status', stage: 'Building your mix' },
        { type: 'delta', delta: 'A two-track playlist for a quiet night.' },
        {
          type: 'done',
          conversationId: '11111111-1111-4111-8111-111111111111',
          role: 'assistant',
          content: 'A two-track playlist for a quiet night.',
          tracks: TEST_TRACKS,
          isPlaylistSuggestion: true,
        },
      ],
    },
  });

  await page.goto('/chat');
  await page.getByRole('textbox', { name: 'Message MUSE' }).fill(
    'Build a quiet late-night playlist',
  );
  await page.getByRole('textbox', { name: 'Message MUSE' }).press('Enter');

  const preview = page.getByTestId('playlist-preview');
  await expect(preview).toBeVisible();
  await preview.getByRole('textbox', { name: 'Playlist Name' }).fill(
    'Lagos Night Drive',
  );

  await preview.getByRole('button', { name: 'Save to MUSE Playlists' }).click();
  await expect(preview.getByTestId('playlist-draft-status')).toHaveText(
    'Playlist saved to MUSE Playlists.',
  );

  await preview.getByRole('button', { name: 'Create in Spotify' }).click();
  await expect(preview.getByTestId('create-in-spotify-status')).toHaveText(
    'Playlist created in Spotify.',
  );
  await expect(
    preview.getByRole('link', { name: 'Open in Spotify' }),
  ).toBeVisible();
  await expect(preview.getByRole('link', { name: 'Open in Spotify' })).toHaveAttribute(
    'href',
    'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
  );
});
