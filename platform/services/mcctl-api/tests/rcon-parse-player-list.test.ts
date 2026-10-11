import { describe, it, expect } from 'vitest';
import { parsePlayerList } from '../src/lib/rcon.js';

describe('parsePlayerList (#600)', () => {
  it('returns no players when the response carries only a trailing ANSI reset', () => {
    expect(parsePlayerList('There are 0 of a max of 20 players online: \x1b[0m')).toEqual({
      online: 0,
      max: 20,
      players: [],
    });
  });

  it('strips ANSI codes around real player names', () => {
    expect(parsePlayerList('There are 2 of a max of 20 players online: \x1b[0mSteve, Alex\x1b[0m')).toEqual({
      online: 2,
      max: 20,
      players: ['Steve', 'Alex'],
    });
  });

  it('strips partial ANSI codes where the ESC byte was lost ("[0m")', () => {
    expect(parsePlayerList('There are 0 of a max of 20 players online: [0m')).toEqual({
      online: 0,
      max: 20,
      players: [],
    });
  });

  it('keeps the legacy default for unparseable responses', () => {
    expect(parsePlayerList('Unknown command')).toEqual({ online: 0, max: 20, players: [] });
  });
});
