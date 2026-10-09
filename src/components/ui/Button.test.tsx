import { render, screen } from '@testing-library/react';
import { Button, buttonVariants } from './Button';
import { describe, it, expect } from 'vitest';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeDefined();
  });

  it('applies variant classes', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button').className).toContain('bg-accent-primary');

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button').className).toContain('bg-surface');
  });

  it('defaults to a non-submitting button type', () => {
    render(<Button>Open panel</Button>);
    expect(screen.getByRole('button', { name: 'Open panel' })).toHaveAttribute(
      'type',
      'button',
    );
  });

  it('keeps every size at or above the 40px pointer target', () => {
    // Tailwind heights: h-10 = 40px, h-11 = 44px, h-12 = 48px.
    expect(buttonVariants({ size: 'sm' })).toContain('h-10');
    expect(buttonVariants({ size: 'md' })).toContain('h-11');
    expect(buttonVariants({ size: 'lg' })).toContain('h-12');
    for (const size of ['sm', 'md', 'lg'] as const) {
      expect(buttonVariants({ size })).not.toMatch(/\bh-[0-9]\b/);
    }
  });

  it('is disabled and announced busy while loading, with the equalizer shown', () => {
    render(<Button loading>Saving</Button>);
    const button = screen.getByRole('button', { name: /Saving/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('equalizer')).toHaveAttribute(
      'data-paused',
      'false',
    );
  });

  it('shows no equalizer when idle', () => {
    render(<Button>Save</Button>);
    expect(screen.queryByTestId('equalizer')).toBeNull();
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy');
  });

  it('shares its classes with link-shaped buttons', () => {
    render(
      <a
        href="/chat"
        className={buttonVariants({ variant: 'outline', size: 'sm' })}
      >
        Go to chat
      </a>,
    );
    const link = screen.getByRole('link', { name: 'Go to chat' });
    expect(link.className).toContain('border-border-strong');
    expect(link.className).toContain('h-10');
  });
});
