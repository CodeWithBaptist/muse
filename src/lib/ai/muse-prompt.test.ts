import { describe, expect, it } from 'vitest';
import {
  chatSystemPrompt,
  languageInstruction,
  playlistSystemPrompt,
  scopeInstruction,
} from './muse-prompt';
import { buildPlaylistPrompt } from './playlist-engine';
import { OPEN_CHAT_STAGES } from '@/app/api/chat/open-chat';
import { VIBE_CHIPS } from '@/components/chat/VibeChips';
import {
  CHAT_LANGUAGES,
  DEFAULT_CHAT_PREFERENCES,
  normaliseChatPreferences,
} from '@/lib/chat-preferences';
import { ChatPostInputSchema } from '@/lib/validation/api-schemas';

const GENRES = [
  'Afrobeats',
  'Afro-fusion',
  'Amapiano',
  'Alte',
  'Street-pop',
  'Highlife',
  'Fuji',
  'Juju',
  'Apala',
  'Naija hip-hop',
  'Gospel',
  'classics',
];

describe('MUSE prompt (Nigeria first)', () => {
  it('names every genre from the brief, the Naira and WAT context, and the honesty rule', () => {
    const prompt = playlistSystemPrompt(DEFAULT_CHAT_PREFERENCES);
    for (const genre of GENRES) expect(prompt).toContain(genre);
    expect(prompt).toContain('West Africa Time (WAT)');
    expect(prompt).toContain('Naira');
    expect(prompt).toContain('leave it out and say so rather than guess');
    expect(prompt).toContain('Never claim a playlist has been created');
  });

  it('explains every vibe chip so the chip label can be the whole message', () => {
    const prompt = playlistSystemPrompt(DEFAULT_CHAT_PREFERENCES).toLowerCase();
    const keyPhrases: Record<string, string> = {
      'Detty December': 'detty december',
      'Lagos traffic': 'lagos traffic',
      Owambe: 'owambe',
      'Sunday rice and stew': 'sunday rice and stew',
      'Late-night drive on the Third Mainland': 'third mainland',
      'Campus read-and-cram': 'read-and-cram',
      'Morning devotion': 'morning devotion',
      'Gym grind': 'gym grind',
      'Heartbreak but make it danceable': 'heartbreak but make it danceable',
    };
    expect(Object.keys(keyPhrases)).toEqual([...VIBE_CHIPS]);
    for (const phrase of Object.values(keyPhrases))
      expect(prompt).toContain(phrase);
  });

  it('leans Nigerian by default and drops the lean on the Global toggle', () => {
    expect(scopeInstruction('nigeria')).toContain(
      'at least six songs should be Nigerian',
    );
    expect(scopeInstruction('nigeria')).toContain('honour it fully');
    expect(scopeInstruction('global')).toContain('No regional lean');
    expect(
      buildPlaylistPrompt('gym', [], { scope: 'nigeria', language: 'english' }),
    ).toContain('Lead with Nigerian music');
    expect(
      buildPlaylistPrompt('gym', [], { scope: 'global', language: 'english' }),
    ).toContain('no regional lean');
  });

  it('switches the language of MUSE\u2019s own words and keeps titles as released', () => {
    expect(languageInstruction('english')).toContain('No Pidgin');
    expect(languageInstruction('pidgin')).toContain('natural Nigerian Pidgin');
    expect(languageInstruction('pidgin')).toContain('not a caricature');
    expect(languageInstruction('mix')).toContain('mostly English');
    for (const language of CHAT_LANGUAGES) {
      expect(languageInstruction(language)).toContain(
        'stay exactly as released',
      );
      expect(playlistSystemPrompt({ scope: 'nigeria', language })).toContain(
        languageInstruction(language),
      );
      expect(chatSystemPrompt({ scope: 'global', language })).toContain(
        languageInstruction(language),
      );
    }
  });

  it('tells the open chat it has no listening data unless the caller says otherwise', () => {
    expect(chatSystemPrompt(DEFAULT_CHAT_PREFERENCES)).toContain(
      'do not have access',
    );
    expect(
      chatSystemPrompt(DEFAULT_CHAT_PREFERENCES, { hasListeningData: true }),
    ).not.toContain('do not have access');
  });

  it('has a status line per stage in every language', () => {
    for (const language of CHAT_LANGUAGES) {
      const stages = OPEN_CHAT_STAGES[language];
      expect(stages.understanding.length).toBeGreaterThan(0);
      expect(stages.building.length).toBeGreaterThan(0);
      expect(stages.composing.length).toBeGreaterThan(0);
    }
    expect(OPEN_CHAT_STAGES.pidgin.building).toBe('Dey find the tracks');
  });
});

describe('chat preferences', () => {
  it('fills gaps and rejects unknown values', () => {
    expect(normaliseChatPreferences(undefined)).toEqual(
      DEFAULT_CHAT_PREFERENCES,
    );
    expect(normaliseChatPreferences({ scope: 'global' })).toEqual({
      scope: 'global',
      language: 'english',
    });
    expect(
      normaliseChatPreferences({ scope: 'mars', language: 'pidgin' }),
    ).toEqual({
      scope: 'nigeria',
      language: 'pidgin',
    });
  });

  it('is accepted by the chat schema only with known values', () => {
    expect(
      ChatPostInputSchema.safeParse({
        content: 'owambe',
        preferences: { scope: 'global', language: 'mix' },
      }).success,
    ).toBe(true);
    expect(
      ChatPostInputSchema.safeParse({ content: 'owambe', preferences: {} })
        .success,
    ).toBe(true);
    expect(
      ChatPostInputSchema.safeParse({
        content: 'owambe',
        preferences: { language: 'french' },
      }).success,
    ).toBe(false);
  });
});
