import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StartAction } from './StartAction';

describe('StartAction', () => {
  it('is a plain link into the chat that needs no account', () => {
    render(<StartAction actionAttribute="data-muse-hero-action" />);
    const link = screen.getByRole('link', { name: 'Start' });
    expect(link.getAttribute('href')).toBe('/chat');
    expect(link.hasAttribute('data-muse-hero-action')).toBe(true);
    expect(link.className).toContain('h-11');
  });

  it('has a compact size for the header', () => {
    render(<StartAction size="sm" />);
    expect(screen.getByRole('link', { name: 'Start' }).className).toContain(
      'h-9',
    );
  });
});
