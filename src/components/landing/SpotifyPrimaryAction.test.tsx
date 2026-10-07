import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SpotifyPrimaryAction } from './SpotifyPrimaryAction';

vi.mock('motion/react', async () => {
  const { motionMock } = await import('@/test/motion-mock');
  return motionMock;
});

describe('SpotifyPrimaryAction', () => {
  it('offers the Spotify connection when sign-in is configured', () => {
    render(<SpotifyPrimaryAction />);
    const button = screen.getByRole('button', { name: 'Connect Spotify' });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders a disabled, explained button when sign-in is not configured', () => {
    render(<SpotifyPrimaryAction available={false} />);
    expect(
      screen.queryByRole('button', { name: 'Connect Spotify' }),
    ).toBeNull();

    const button = screen.getByRole('button', {
      name: 'Spotify connection unavailable',
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);

    const describedBy = button.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const description = document.getElementById(describedBy as string);
    expect(description?.textContent).toContain(
      'Spotify sign-in is not configured for this deployment yet',
    );
  });

  it('points at a visible explanation when the caller renders one', () => {
    render(
      <>
        <SpotifyPrimaryAction
          available={false}
          unavailableDescriptionId="why"
        />
        <p id="why">Visible explanation</p>
      </>,
    );
    const button = screen.getByRole('button', {
      name: 'Spotify connection unavailable',
    });
    expect(button.getAttribute('aria-describedby')).toBe('why');
    // No duplicate hidden copy when a visible one exists.
    expect(
      screen.queryAllByText(/not configured for this deployment/),
    ).toHaveLength(0);
  });

  it('never attaches the canvas lift marker to the disabled button', () => {
    render(
      <SpotifyPrimaryAction
        available={false}
        actionAttribute="data-muse-hero-action"
      />,
    );
    const button = screen.getByRole('button', {
      name: 'Spotify connection unavailable',
    });
    expect(button.hasAttribute('data-muse-hero-action')).toBe(false);
  });

  it('shortens only the label in the compact header size', () => {
    render(<SpotifyPrimaryAction available={false} size="sm" />);
    const button = screen.getByRole('button', { name: 'Spotify unavailable' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    const description = document.getElementById(
      button.getAttribute('aria-describedby') as string,
    );
    expect(description?.textContent).toContain(
      'not configured for this deployment yet',
    );
  });
});
