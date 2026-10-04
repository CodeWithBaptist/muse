import { render, screen } from '@testing-library/react';
import HomePage from './page';
import { describe, it, expect, vi } from 'vitest';

vi.mock('motion/react', async () => {
  const { motionMock } = await import('@/test/motion-mock');
  return motionMock;
});

describe('Landing Page', () => {
  it('renders the MUSE brand wordmark and hero heading', () => {
    render(<HomePage />);
    const logos = screen.getAllByRole('img', { name: /muse/i });
    expect(logos.length).toBeGreaterThan(0);

    const heading = screen.getByRole('heading', {
      level: 1,
      name: /your music,\s*understood\./i,
    });
    expect(heading).toBeDefined();
    expect(heading.tagName).toBe('H1');
  });

  it('renders an enabled Spotify connection button for unauthenticated visitors', () => {
    render(<HomePage />);
    const button = screen.getByRole('button', { name: /connect spotify/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });
});
