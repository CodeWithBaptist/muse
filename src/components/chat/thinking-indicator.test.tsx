// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThinkingIndicator, WAITING_LINE } from './ThinkingIndicator';

describe('ThinkingIndicator', () => {
  it('shows one plain waiting line in the chosen language', () => {
    expect(WAITING_LINE.english).toBe('Finding tracks');
    expect(WAITING_LINE.pidgin).toBe('Dey find the tracks');
    expect(WAITING_LINE.mix).toBe('Finding tracks');
    render(<ThinkingIndicator language="pidgin" />);
    expect(screen.getByRole('status')).toHaveTextContent('Dey find the tracks');
    expect(screen.getByRole('status').textContent).not.toMatch(/[.!]{2,}/);
  });

  it('lets the stage from the server replace the waiting line', () => {
    render(
      <ThinkingIndicator language="pidgin" stage="Dey check the catalogue" />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Dey check the catalogue',
    );
  });
});
