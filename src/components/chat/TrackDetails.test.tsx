import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackDetailsPanel, TrackDetailsProvider } from './TrackDetails';
import { RecommendationList } from './RecommendationList';
import type { ListedTrack } from '@/lib/catalogue/types';

vi.mock('next/navigation', () => ({ usePathname: () => '/chat' }));
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ authenticated: false }),
}));
vi.mock(
  'motion/react',
  async () => (await import('@/test/motion-mock')).motionMock,
);
const tracks: ListedTrack[] = [
  {
    id: 'one',
    title: 'Free Mind',
    artist: 'Tems',
    why: 'A calm start.',
    region: 'Nigeria',
    verification: {
      status: 'verified',
      source: 'deezer',
      url: 'https://www.deezer.com/track/1',
      artworkUrl: 'https://example.com/art.jpg',
    },
  },
  {
    id: 'two',
    title: 'Essence',
    artist: 'Wizkid',
    why: 'For the groove.',
    region: 'Nigeria',
  },
];

function setup() {
  return render(
    <TrackDetailsProvider>
      <RecommendationList title="Night drive" tracks={tracks} />
      <TrackDetailsPanel />
    </TrackDetailsProvider>,
  );
}

describe('guest track details', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
  });

  it('opens a mobile sheet with artwork, reason, status and ordered links, then closes', () => {
    setup();
    expect(screen.queryByText(/active Spotify device/)).toBeNull();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Show details for Free Mind by Tems',
      }),
    );
    const sheet = screen.getByRole('dialog', { name: 'Track details' });
    expect(sheet).toHaveAttribute('open');
    expect(
      within(sheet).getByText('Why this: A calm start.'),
    ).toBeInTheDocument();
    expect(within(sheet).getByText('Verified on Deezer')).toBeInTheDocument();
    expect(within(sheet).getByTestId('track-art')).toHaveAttribute(
      'src',
      'https://example.com/art.jpg',
    );
    const links = within(within(sheet).getByRole('navigation')).getAllByRole(
      'link',
    );
    expect(links.map((link) => link.textContent)).toEqual([
      'Audiomack',
      'Boomplay',
      'YouTube Music',
      'Apple Music',
      'Deezer',
      'Spotify',
    ]);
    expect(links[4]).toHaveAttribute('href', 'https://www.deezer.com/track/1');
    expect(
      within(sheet).getByRole('button', { name: 'Copy list' }),
    ).toBeInTheDocument();
    expect(within(sheet).getByText('Share on WhatsApp')).toBeInTheDocument();
    fireEvent.click(
      within(sheet).getByRole('button', { name: 'Close track details' }),
    );
    expect(sheet).not.toHaveAttribute('open');
  });

  it('shows unverified and a fallback when no artwork is available', () => {
    setup();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Show details for Essence by Wizkid',
      }),
    );
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('Unverified')).toBeInTheDocument();
    expect(within(sheet).getByTestId('track-art-initial')).toHaveTextContent(
      'E',
    );
    fireEvent(sheet, new Event('cancel', { bubbles: true }));
    expect(sheet).not.toHaveAttribute('open');
  });
});
