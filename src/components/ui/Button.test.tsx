import { render, screen } from '@testing-library/react';
import { Button } from './Button';
import { describe, it, expect } from 'vitest';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeDefined();
  });

  it('applies variant classes', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button').className).toContain('bg-accent');

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
});
