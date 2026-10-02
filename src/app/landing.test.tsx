import { render, screen } from '@testing-library/react';
import HomePage from './page';
import { describe, it, expect, vi } from 'vitest';

// Mock Framer Motion to avoid issues in test environment
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    motion: {
      div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
      h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
      p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
      button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

describe('Landing Page', () => {
  it('renders the MUSE hero title', () => {
    render(<HomePage />);
    const headings = screen.getAllByText('MUSE');
    expect(headings.length).toBeGreaterThan(0);
    expect(headings[0].tagName).toBe('H1');
  });

  it('renders a disabled Spotify connection button', () => {
    render(<HomePage />);
    const button = screen.getByRole('button', { name: /connect spotify/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
