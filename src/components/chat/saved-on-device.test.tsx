import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListedTrack } from '@/lib/catalogue/types';
import {
  SavedOnDeviceButton,
  SavedOnDevicePanel,
  savedListDateLabel,
} from './SavedOnDevice';
import {
  clearSavedLists,
  saveGuestList,
  SAVED_LIST_NOTE,
} from '@/lib/guest-saved-store';

const track: ListedTrack = {
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
};

function Host() {
  const [open, setOpen] = React.useState(true);
  return (
    <>
      <SavedOnDeviceButton open={open} onToggle={() => setOpen(!open)} />
      <div hidden={!open}>
        <SavedOnDevicePanel />
      </div>
    </>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  clearSavedLists();
});

describe('SavedOnDevice', () => {
  it('counts the saved lists on its control and names the panel it opens', () => {
    saveGuestList({ title: 'Late night', tracks: [track] });
    saveGuestList({ title: 'Morning', tracks: [{ ...track, id: 'two' }] });
    render(<Host />);
    const button = screen.getByTestId('saved-on-device-button');
    expect(button.textContent).toContain('Saved on this device (2)');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe('saved-on-device-panel');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows the title, the song count, and where the list lives', () => {
    saveGuestList({
      title: 'Third Mainland at 1am',
      tracks: [track],
      savedAt: '2026-10-13T09:00:00.000Z',
    });
    render(<SavedOnDevicePanel />);
    const item = screen.getByTestId('saved-list-item');
    expect(within(item).getByText('Third Mainland at 1am')).toBeDefined();
    expect(item.textContent).toContain('1 song saved');
    expect(screen.getByTestId('saved-on-device-note').textContent).toBe(
      SAVED_LIST_NOTE,
    );
  });

  it('offers copy, text, CSV, share, and the open-in links for each list', () => {
    saveGuestList({ title: 'Late night', tracks: [track] });
    render(<SavedOnDevicePanel />);
    const item = screen.getByTestId('saved-list-item');
    expect(
      within(item).getByRole('button', { name: 'Copy list' }),
    ).toBeDefined();
    expect(
      within(item).getByRole('button', { name: 'Download as CSV' }),
    ).toBeDefined();
    // jsdom has no Web Share API, so the WhatsApp fallback is the share.
    expect(within(item).getByTestId('share-whatsapp')).toBeDefined();
    fireEvent.click(
      within(item).getByRole('button', {
        name: 'Songs and open-in links',
      }),
    );
    // Audiomack and Boomplay lead, the other four sit behind the same small
    // "More" toggle the track rows use. All six are reachable.
    for (const service of ['audiomack', 'boomplay']) {
      expect(item.querySelector(`a[data-open-in="${service}"]`)).not.toBeNull();
    }
    fireEvent.click(within(item).getByRole('button', { name: 'More' }));
    for (const service of [
      'youtube-music',
      'apple-music',
      'deezer',
      'spotify',
    ]) {
      expect(item.querySelector(`a[data-open-in="${service}"]`)).not.toBeNull();
    }
  });

  it('copies the list and reports the outcome', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    saveGuestList({ title: 'Late night', tracks: [track] });
    render(<SavedOnDevicePanel />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy list' }));
    });
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).toContain('1. Essence by Wizkid');
    expect(screen.getByText('List copied.')).toBeDefined();
  });

  it('downloads the list as CSV with the file named after the title', () => {
    const createObjectURL = vi.fn(() => 'blob:one');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURL,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURL,
      configurable: true,
    });
    const clicked: string[] = [];
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click(
      this: HTMLAnchorElement,
    ) {
      clicked.push(this.download);
    };
    try {
      saveGuestList({ title: 'Late night', tracks: [track] });
      render(<SavedOnDevicePanel />);
      fireEvent.click(screen.getByRole('button', { name: 'Download as CSV' }));
      expect(createObjectURL).toHaveBeenCalledOnce();
      expect(clicked).toEqual(['muse-late-night.csv']);
      expect(screen.getByText('CSV downloaded.')).toBeDefined();
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }
  });

  it('deletes one list and clears all of them, without a confirmation trap', () => {
    saveGuestList({ title: 'Late night', tracks: [track] });
    saveGuestList({ title: 'Morning', tracks: [{ ...track, id: 'two' }] });
    render(<SavedOnDevicePanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Late night' }));
    expect(screen.queryByText('Late night')).toBeNull();
    expect(screen.getAllByTestId('saved-list-item')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.queryByTestId('saved-list')).toBeNull();
    expect(
      screen.getByText(
        'Cleared. Every saved list has been removed from this browser.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();
  });

  it('says when there is nothing saved yet', () => {
    render(<SavedOnDevicePanel />);
    expect(
      screen.getByText(
        'Nothing saved yet. Lists MUSE builds for you are kept here.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();
  });

  it('labels a saved date plainly and drops an unreadable one', () => {
    expect(savedListDateLabel('2026-10-13T09:00:00.000Z')).toBe('13 Oct');
    expect(savedListDateLabel('not a date')).toBe('');
  });
});
