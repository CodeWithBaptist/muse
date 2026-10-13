import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockAppApi, type MockAppApiOptions } from './fixtures';

/**
 * The guest-only public launch, end to end at phone widths.
 *
 * Every case here starts from a fresh browser context, so storage is empty
 * exactly as it would be for a first visit. The tester cases at the end check
 * that nothing a tester already had is lost.
 */

const GUEST_TRACKS = [
  {
    id: 'wizkid--essence',
    title: 'Essence',
    artist: 'Wizkid',
    why: 'Slow heat for a late drive.',
    region: 'Nigeria',
    verification: {
      status: 'verified',
      source: 'deezer',
      id: '1',
      url: 'https://www.deezer.com/track/1',
    },
  },
  {
    id: 'tems--free-mind',
    title: 'Free Mind',
    artist: 'Tems',
    why: 'A calm stretch.',
    region: 'Nigeria',
    verification: {
      status: 'unverified',
      reason: 'title_not_found',
    },
  },
];

const PLAYLIST_TITLE = 'Third Mainland at 1am';

const guestChat: MockAppApiOptions['chatResponse'] = {
  events: [
    { type: 'status', stage: 'Building your list' },
    { type: 'delta', delta: 'Windows down for these ones.' },
    {
      type: 'done',
      role: 'assistant',
      content: 'Windows down for these ones.',
      playlistTitle: PLAYLIST_TITLE,
      recommendations: GUEST_TRACKS,
    },
  ],
};

/** A tester's stream: Spotify-backed tracks, the shape the closed path returns. */
const testerChat: MockAppApiOptions['chatResponse'] = {
  events: [
    { type: 'status', stage: 'Searching Spotify catalog' },
    { type: 'delta', delta: 'Here are a few late-night picks.' },
    {
      type: 'done',
      conversationId: '11111111-1111-4111-8111-111111111111',
      role: 'assistant',
      content: 'Here are a few late-night picks.',
      tracks: [
        {
          id: '3n3Ppam7vgaVa1iaRUc9Lp',
          uri: 'spotify:track:3n3Ppam7vgaVa1iaRUc9Lp',
          name: 'Cranes in the Sky',
          artists: [{ name: 'Solange' }],
          album: { name: 'A Seat at the Table', images: [] },
          duration_ms: 243_000,
          reason: 'Soft vocals suit the late-night mood.',
        },
      ],
    },
  ],
};

for (const width of [360, 390]) {
  test.describe(`guest at ${width}px`, () => {
    test.use({
      viewport: { width, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
      permissions: ['clipboard-read', 'clipboard-write'],
    });

    test('starts, chats, saves, copies, downloads, shares, deletes, and clears', async ({
      page,
      context,
    }) => {
      await mockAppApi(page, { authenticated: false, chatResponse: guestChat });

      // Start: the landing page opens the chat and offers no account action.
      await page.goto('/');
      const start = page.getByRole('link', { name: 'Start' }).first();
      await expect(start).toBeVisible();
      expect(
        await page.locator('text=/Sign in|Create account|Log in/').count(),
      ).toBe(0);

      await start.click();
      await expect(page).toHaveURL(/\/chat$/);
      await expect(
        page.getByRole('heading', { name: 'Say the vibe.' }),
      ).toBeVisible();

      // Chat: no account surface anywhere, and the two tab bar destinations.
      await expect(page.getByRole('button', { name: 'Account' })).toHaveCount(
        0,
      );
      await expect(page.getByRole('button', { name: 'Log out' })).toHaveCount(
        0,
      );
      await expect(page.getByRole('link', { name: 'Settings' })).toHaveCount(0);
      const tabs = page.getByTestId('bottom-tabs');
      await expect(tabs.getByRole('link')).toHaveCount(2);
      await expect(
        tabs.getByRole('link', { name: 'Chat', exact: true }),
      ).toBeVisible();
      await expect(
        tabs.getByRole('link', { name: 'Profile', exact: true }),
      ).toBeVisible();
      await expect(tabs.getByRole('link', { name: 'Discover' })).toHaveCount(0);
      await expect(tabs.getByRole('link', { name: 'Library' })).toHaveCount(0);
      await expect(tabs.getByRole('link', { name: 'Playlists' })).toHaveCount(
        0,
      );
      expect(
        (await new AxeBuilder({ page }).include('.muse-bottom-tabs').analyze())
          .violations,
      ).toEqual([]);

      const input = page.getByRole('textbox', { name: 'Message MUSE' });
      await input.fill('Lagos traffic at night');
      await input.press('Enter');
      await expect(
        page.getByText('Windows down for these ones.'),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: PLAYLIST_TITLE }),
      ).toBeVisible();

      // The list is kept on the device without a second tap.
      const savedCount = page.getByTestId('saved-on-device-button');
      await expect(savedCount).toContainText('Saved on this device (1)');
      const stored = await page.evaluate(() =>
        window.localStorage.getItem('muse.saved.lists.v1'),
      );
      expect(stored).toContain('wizkid--essence');
      expect(
        await page.evaluate(() =>
          window.localStorage.getItem('muse.chat.local.v1'),
        ),
      ).toContain('Lagos traffic at night');

      await savedCount.click();
      const panel = page.getByTestId('saved-on-device-panel');
      await expect(panel).toBeVisible();
      await expect(panel.getByTestId('saved-on-device-note')).toHaveText(
        'Saved items live in this browser and disappear if you clear your browser data.',
      );
      const item = panel.getByTestId('saved-list-item');
      await expect(item).toContainText(PLAYLIST_TITLE);
      await expect(item).toContainText('2 songs');

      // Copy.
      await item.getByRole('button', { name: 'Copy list' }).click();
      await expect(item.getByText('List copied.')).toBeVisible();
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      expect(copied).toContain('1. Essence by Wizkid');
      expect(copied).toContain('2. Free Mind by Tems');

      // Text and CSV downloads.
      const textDownload = page.waitForEvent('download');
      await item.getByRole('button', { name: 'Download as text' }).click();
      expect((await textDownload).suggestedFilename()).toBe(
        'muse-third-mainland-at-1am.txt',
      );
      await expect(item.getByText('Text file downloaded.')).toBeVisible();

      const csvDownload = page.waitForEvent('download');
      await item.getByRole('button', { name: 'Download as CSV' }).click();
      expect((await csvDownload).suggestedFilename()).toBe(
        'muse-third-mainland-at-1am.csv',
      );
      await expect(item.getByText('CSV downloaded.')).toBeVisible();

      // Share. When the browser has no share sheet the WhatsApp link takes
      // over, carrying the list as text; both paths are one press away.
      const canShare = await page.evaluate(
        () => typeof navigator.share === 'function',
      );
      if (canShare) {
        await expect(
          item.getByRole('button', { name: 'Share list' }),
        ).toBeVisible();
      } else {
        const share = item.getByTestId('share-whatsapp');
        await expect(share).toBeVisible();
        const shareHref = (await share.getAttribute('href')) ?? '';
        expect(shareHref.startsWith('https://wa.me/?text=')).toBe(true);
        expect(decodeURIComponent(shareHref)).toContain('Essence by Wizkid');
      }

      // Open-in links: the six services, all reachable from the saved list.
      await item
        .getByRole('button', { name: 'Songs and open-in links' })
        .click();
      for (const service of ['audiomack', 'boomplay']) {
        await expect(
          item.locator(`[data-open-in="${service}"]`).first(),
        ).toBeVisible();
      }
      await item.getByRole('button', { name: 'More' }).first().click();
      for (const service of [
        'youtube-music',
        'apple-music',
        'deezer',
        'spotify',
      ]) {
        await expect(
          item.locator(`[data-open-in="${service}"]`).first(),
        ).toBeVisible();
      }

      // Delete removes that list and keeps the rest.
      await item
        .getByRole('button', { name: `Delete ${PLAYLIST_TITLE}` })
        .click();
      await expect(panel.getByTestId('saved-list-item')).toHaveCount(0);
      expect(
        await page.evaluate(() =>
          window.localStorage.getItem('muse.saved.lists.v1'),
        ),
      ).toBeNull();

      // Save a second list by chatting again, then clear them all at once.
      await input.fill('Something calmer');
      await input.press('Enter');
      await expect(
        page.getByText('Windows down for these ones.'),
      ).toBeVisible();
      await expect(savedCount).toContainText('Saved on this device (1)');
      await panel.getByRole('button', { name: 'Clear all' }).click();
      await expect(panel.getByTestId('saved-list')).toHaveCount(0);
      await expect(
        panel.getByText(
          'Cleared. Every saved list has been removed from this browser.',
        ),
      ).toBeVisible();
      expect(
        await page.evaluate(() =>
          window.localStorage.getItem('muse.saved.lists.v1'),
        ),
      ).toBeNull();

      // The chat itself is still there, and a new browser is a new visitor.
      await page.reload();
      await expect(
        page.getByText('Windows down for these ones.'),
      ).toBeVisible();
      await expect(savedCount).toContainText('Saved on this device (0)');
      const fresh = await context.newPage();
      await mockAppApi(fresh, {
        authenticated: false,
        chatResponse: guestChat,
      });
      await fresh.goto('/chat');
      await expect(fresh.getByTestId('saved-on-device-button')).toContainText(
        'Saved on this device (0)',
      );
      await fresh.close();
    });

    test('sends a guest from every hidden route to Chat with no error', async ({
      page,
    }) => {
      await mockAppApi(page, { authenticated: false, chatResponse: guestChat });

      for (const path of ['/library', '/discover', '/playlists', '/settings']) {
        await page.goto(path);
        await expect(page).toHaveURL(/\/chat$/);
        await expect(
          page.getByRole('heading', { name: 'Say the vibe.' }),
        ).toBeVisible();
        // No error banner, no library content, and no retry loops.
        await expect(page.getByRole('alert')).toHaveCount(0);
        await expect(
          page.getByRole('heading', { name: 'Library', level: 1 }),
        ).toHaveCount(0);
        await expect(
          page.getByRole('heading', { name: 'Discover', level: 1 }),
        ).toHaveCount(0);
      }
    });

    test('shows the six open-in links to a guest and no Spotify playback text', async ({
      page,
    }) => {
      await mockAppApi(page, { authenticated: false, chatResponse: guestChat });
      await page.goto('/chat');
      const input = page.getByRole('textbox', { name: 'Message MUSE' });
      await input.fill('Something for the drive');
      await input.press('Enter');
      await expect(
        page.getByRole('heading', { name: PLAYLIST_TITLE }),
      ).toBeVisible();

      await page
        .getByRole('button', { name: 'Show details for Essence by Wizkid' })
        .click();
      const sheet = page.getByRole('dialog', { name: 'Track details' });
      await expect(sheet).toBeVisible();
      for (const service of [
        'audiomack',
        'boomplay',
        'youtube-music',
        'apple-music',
        'deezer',
        'spotify',
      ]) {
        await expect(sheet.locator(`[data-open-in="${service}"]`)).toHaveCount(
          1,
        );
      }
      await expect(sheet.getByText(/playback/i)).toHaveCount(0);
      await expect(sheet.getByText(/Premium/i)).toHaveCount(0);
      await expect(sheet.getByRole('button', { name: /^Play / })).toHaveCount(
        0,
      );
      expect(
        (await new AxeBuilder({ page }).include('.muse-sheet').analyze())
          .violations,
      ).toEqual([]);
    });

    test('offers Send feedback in the footer and the chat menu', async ({
      page,
    }) => {
      await mockAppApi(page, { authenticated: false, chatResponse: guestChat });
      await page.goto('/');
      const footerFeedback = page
        .getByRole('contentinfo')
        .getByTestId('send-feedback');
      await expect(footerFeedback).toBeVisible();
      expect(await footerFeedback.getAttribute('href')).toBe(
        'mailto:barowomutin@gmail.com?subject=MUSE%20feedback',
      );

      await page.goto('/chat');
      const chatFeedback = page.getByTestId('send-feedback');
      await expect(chatFeedback).toBeVisible();
      expect(await chatFeedback.getAttribute('href')).toBe(
        'mailto:barowomutin@gmail.com?subject=MUSE%20feedback',
      );
      // Nothing was added that could track the tap.
      expect(
        await page
          .locator('script[src*="gtag"], script[src*="analytics"]')
          .count(),
      ).toBe(0);
    });
  });
}

test.describe('tester', () => {
  test('keeps every page, control, and account surface', async ({ page }) => {
    await mockAppApi(page, { authenticated: true, chatResponse: testerChat });
    await page.setViewportSize({ width: 360, height: 844 });
    await page.goto('/chat');

    const tabs = page.getByTestId('bottom-tabs');
    await expect(tabs.getByRole('link')).toHaveCount(6);
    for (const label of [
      'Chat',
      'Discover',
      'Library',
      'Playlists',
      'Profile',
      'Settings',
    ]) {
      await expect(tabs.getByRole('link', { name: label })).toBeVisible();
    }

    // The account sheet still opens, still offers Settings and Log out.
    const account = page.getByRole('button', { name: 'Account' });
    await expect(account).toBeVisible();
    await account.click();
    const sheet = page.getByRole('dialog', { name: 'Account' });
    await expect(sheet.getByText('Spotify connected')).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Settings' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Log out' })).toBeVisible();
    await page.keyboard.press('Escape');

    // A tester's chat reply is still Spotify-backed, with the mini player and
    // the tester export; no guest saved-on-device control is added.
    const input = page.getByRole('textbox', { name: 'Message MUSE' });
    await input.fill('Late night picks');
    await input.press('Enter');
    await expect(
      page.getByText('Here are a few late-night picks.'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Select Cranes in the Sky' }).first(),
    ).toBeVisible();
    await expect(page.getByTestId('saved-on-device-button')).toHaveCount(0);

    await page.goto('/library');
    await expect(page).toHaveURL(/\/library$/);
    await expect(
      page.getByRole('heading', { name: 'Library', level: 1 }),
    ).toBeVisible();

    await page.goto('/playlists');
    await expect(page).toHaveURL(/\/playlists$/);
    await expect(
      page.getByRole('heading', { name: 'Playlists', level: 1 }),
    ).toBeVisible();

    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings$/);
    await expect(
      page.getByRole('heading', { name: 'Settings', level: 1 }),
    ).toBeVisible();
  });
});
