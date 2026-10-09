// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { RecommendationList } from './RecommendationList';
import type { ListedTrack } from '@/lib/catalogue/types';

const tracks: ListedTrack[] = [
  {
    id: 'wizkid--essence',
    title: 'Essence',
    artist: 'Wizkid',
    why: 'Slow heat.',
    region: 'Nigeria',
    verification: {
      status: 'verified',
      source: 'deezer',
      id: '1',
      url: 'https://www.deezer.com/track/1',
    },
  },
  {
    id: 'asa--jailer',
    title: 'Jailer',
    artist: 'Asa',
    why: 'Voice and guitar.',
    region: 'Nigeria',
    verification: { status: 'unverified', reason: 'title_not_found' },
  },
];

describe('list actions and open-in links', () => {
  const originalShare = navigator.share;
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: vi.fn(() => 'blob:muse'),
        revokeObjectURL: vi.fn(),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(navigator, 'share', {
      value: originalShare,
      configurable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it('shows Audiomack and Boomplay on every song and the rest behind More, with the catalogue page for verified picks', () => {
    render(<RecommendationList tracks={tracks} title="Sunday" />);
    const rows = screen.getAllByTestId('recommendation-row');
    const visible = (row: HTMLElement) =>
      Array.from(row.querySelectorAll('[data-open-in]')).map((a) =>
        a.getAttribute('data-open-in'),
      );
    expect(visible(rows[0])).toEqual(['audiomack', 'boomplay']);
    expect(visible(rows[1])).toEqual(['audiomack', 'boomplay']);

    const more = rows[0].querySelector(
      'button[aria-expanded]',
    ) as HTMLButtonElement;
    expect(more.textContent).toContain('More');
    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(visible(rows[0])).toEqual([
      'audiomack',
      'boomplay',
      'spotify',
      'apple-music',
      'youtube-music',
      'deezer',
    ]);
    const deezer = rows[0].querySelector(
      '[data-open-in="deezer"]',
    ) as HTMLAnchorElement;
    expect(deezer.getAttribute('href')).toBe('https://www.deezer.com/track/1');
    expect(deezer.getAttribute('data-direct')).toBe('true');
    expect(deezer.getAttribute('aria-label')).toBe(
      'Open Essence by Wizkid on Deezer',
    );
    const spotify = rows[0].querySelector(
      '[data-open-in="spotify"]',
    ) as HTMLAnchorElement;
    expect(spotify.getAttribute('href')).toBe(
      'https://open.spotify.com/search/Wizkid%20Essence',
    );
    expect(spotify.getAttribute('aria-label')).toBe(
      'Search for Essence by Wizkid on Spotify',
    );
    for (const link of rows[0].querySelectorAll('a[target="_blank"]')) {
      expect(link.getAttribute('rel')).toContain('noopener');
    }
  });

  it('copies the list as text and reports it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    render(<RecommendationList tracks={tracks} title="Sunday rice and stew" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy list' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const text = writeText.mock.calls[0][0] as string;
    expect(text.split('\n').slice(0, 5)).toEqual([
      'Sunday rice and stew',
      'Built with MUSE',
      '',
      '1. Essence by Wizkid',
      '2. Jailer by Asa',
    ]);
    expect(text).toContain('Make your own: http://localhost:3000/chat');
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('List copied.'),
    );
  });

  it('says so when the clipboard is not available instead of pretending', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });
    render(<RecommendationList tracks={tracks} title="Sunday" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy list' }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        'Copy is not available',
      ),
    );
  });

  it('downloads text and CSV files named after the list', () => {
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this.download);
    });
    render(
      <RecommendationList tracks={tracks} title="Third Mainland at 1am" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Download as text' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download as CSV' }));
    expect(clicks).toEqual([
      'muse-third-mainland-at-1am.txt',
      'muse-third-mainland-at-1am.csv',
    ]);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status').textContent).toBe('CSV downloaded.');
  });

  it('uses the Web Share API when present and a WhatsApp link when not', async () => {
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
    });
    const { unmount } = render(
      <RecommendationList tracks={tracks} title="Owambe" />,
    );
    const whatsApp = screen.getByTestId('share-whatsapp');
    expect(whatsApp.getAttribute('href')).toMatch(
      /^https:\/\/wa\.me\/\?text=Owambe%0ABuilt%20with%20MUSE/,
    );
    expect(screen.queryByRole('button', { name: 'Share list' })).toBeNull();
    unmount();

    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
    });
    render(<RecommendationList tracks={tracks} title="Owambe" />);
    expect(screen.queryByTestId('share-whatsapp')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Share list' }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls[0][0]).toMatchObject({ title: 'Owambe' });
    expect((share.mock.calls[0][0] as { text: string }).text).toContain(
      '1. Essence by Wizkid',
    );
  });
});
