// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import {
  ThinkingIndicator,
  getContextualLoadingMessages,
} from './ThinkingIndicator';

describe('ThinkingIndicator languages', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rotates Pidgin lines when MUSE is speaking Pidgin', () => {
    expect(getContextualLoadingMessages('Lagos traffic', 'pidgin')).toEqual([
      'Dey feel your vibe...',
      'Make I check the sound...',
      'Dey cook your playlist...',
      'Small time, e dey come...',
    ]);
    expect(
      getContextualLoadingMessages('a playlist for owambe', 'pidgin')[0],
    ).toBe('Dey arrange the playlist...');

    render(
      <ThinkingIndicator
        prompt="Lagos traffic"
        language="pidgin"
        intervalMs={100}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Dey feel your vibe...',
    );
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Make I check the sound...',
    );
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Dey cook your playlist...',
    );
  });

  it('alternates English and Pidgin in mix, and keeps English the default', () => {
    expect(getContextualLoadingMessages('Gym grind', 'mix')).toEqual([
      'Understanding your vibe',
      'Make I check the sound...',
      'Finding something that fits',
      'Small time, e dey come...',
    ]);
    expect(getContextualLoadingMessages('Gym grind')).toEqual(
      getContextualLoadingMessages('Gym grind', 'english'),
    );
    expect(
      getContextualLoadingMessages('Why is Fuji so percussive?', 'mix'),
    ).toEqual([
      'Reading your question',
      'Make I reason am well...',
      'Composing response',
    ]);
  });

  it('lets a real stage from the server win over the rotation', () => {
    render(
      <ThinkingIndicator
        prompt="Owambe"
        language="pidgin"
        stage="Dey check Deezer..."
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Dey check Deezer...');
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Dey check Deezer...');
  });
});
