import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WordReveal } from './WordReveal';

describe('WordReveal', () => {
  it('keeps the whole reply in the DOM so it stays readable and selectable', () => {
    render(<WordReveal text="Midnight signals in the dark." />);

    const container = screen.getByTestId('word-reveal');
    expect(container.textContent).toBe('Midnight signals in the dark.');
    expect(screen.getAllByTestId('word-reveal-word')).toHaveLength(5);
  });

  it('starts every word hidden so the reply can fade in', () => {
    render(<WordReveal text="One two three" />);

    for (const word of screen.getAllByTestId('word-reveal-word')) {
      expect(word.className).toContain('opacity-0');
    }
  });

  it('keeps whitespace between words so the text reads normally', () => {
    render(<WordReveal text="Two  spaces stay" />);

    expect(screen.getByTestId('word-reveal').textContent).toBe(
      'Two  spaces stay',
    );
  });
});
