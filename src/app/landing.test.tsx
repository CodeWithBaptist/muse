import { render, screen } from '@testing-library/react';
import HomePage from './page';
import { describe, it, expect, vi } from 'vitest';

function stripMotionProps(props: Record<string, any>) {
  const {
    initial,
    animate,
    exit,
    variants,
    transition,
    whileHover,
    whileTap,
    whileInView,
    viewport,
    layoutId,
    ...domProps
  } = props;
  return domProps;
}

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...stripMotionProps(props)}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...stripMotionProps(props)}>{children}</h1>,
    p: ({ children, ...props }: any) => <p {...stripMotionProps(props)}>{children}</p>,
    button: ({ children, ...props }: any) => <button {...stripMotionProps(props)}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

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
