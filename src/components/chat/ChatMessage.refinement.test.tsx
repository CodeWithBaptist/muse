import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatMessage } from './ChatMessage';
import { parseRefinement } from '@/hooks/use-chat';

vi.mock('motion/react', async () => {
  const { motionMock } = await import('@/test/motion-mock');
  return motionMock;
});

const REFINEMENT = {
  summary: 'No Burna Boy, still late night.',
  excludedArtists: ['Burna Boy'],
  excludedGenres: [],
  avoided: ['too mainstream'],
  newTracks: 2,
  droppedAlreadyShown: 2,
  droppedExcludedArtist: 1,
};

describe('ChatMessage refinement label', () => {
  it('names what changed on a refinement turn', () => {
    render(
      <ChatMessage
        message={{
          role: 'assistant',
          content: 'Here is what changed.',
          refinement: REFINEMENT,
        }}
      />
    );

    expect(screen.getByTestId('refinement-summary')).toBeDefined();
    expect(screen.getByText('Refined')).toBeDefined();
    expect(screen.getByText('No Burna Boy, still late night.')).toBeDefined();
  });

  it('says nothing on a first request, so the label stays meaningful', () => {
    render(
      <ChatMessage
        message={{ role: 'assistant', content: 'Here is a start.' }}
      />
    );

    expect(screen.queryByTestId('refinement-summary')).toBeNull();
  });

  it('never labels the visitor\'s own turn', () => {
    render(
      <ChatMessage
        message={{ role: 'user', content: 'No Burna Boy', refinement: REFINEMENT }}
      />
    );

    expect(screen.queryByTestId('refinement-summary')).toBeNull();
  });
});

describe('parseRefinement', () => {
  it('reads a well formed payload', () => {
    const parsed = parseRefinement(REFINEMENT);
    expect(parsed?.summary).toBe('No Burna Boy, still late night.');
    expect(parsed?.excludedArtists).toEqual(['Burna Boy']);
    expect(parsed?.avoided).toEqual(['too mainstream']);
    expect(parsed?.droppedAlreadyShown).toBe(2);
  });

  it('ignores a payload with no usable summary', () => {
    expect(parseRefinement(null)).toBeUndefined();
    expect(parseRefinement(undefined)).toBeUndefined();
    expect(parseRefinement('No Burna Boy')).toBeUndefined();
    expect(parseRefinement({ summary: '' })).toBeUndefined();
    expect(parseRefinement({ summary: 42 })).toBeUndefined();
  });

  it('drops malformed list entries instead of rendering them', () => {
    const parsed = parseRefinement({
      summary: 'Refined',
      excludedArtists: ['Burna Boy', null, 7, { name: 'x' }],
      newTracks: 'many',
    });

    expect(parsed?.excludedArtists).toEqual(['Burna Boy']);
    expect(parsed?.excludedGenres).toEqual([]);
    expect(parsed?.newTracks).toBe(0);
  });
});
