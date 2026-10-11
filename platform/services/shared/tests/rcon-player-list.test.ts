import { describe, test, expect } from 'vitest';
import { parseRconPlayerList } from '../src/docker/index.js';

describe('parseRconPlayerList', () => {
  test('ignores trailing ANSI reset when nobody is online', () => {
    expect(parseRconPlayerList('There are 0 of a max of 20 players online: \x1b[0m')).toEqual({
      online: 0,
      max: 20,
      players: [],
    });
  });

  test('strips ANSI codes around player names', () => {
    expect(
      parseRconPlayerList('There are 2 of a max of 20 players online: \x1b[0mSteve, Alex\x1b[0m')
    ).toEqual({ online: 2, max: 20, players: ['Steve', 'Alex'] });
  });

  test('strips partial ANSI code without ESC byte', () => {
    expect(parseRconPlayerList('There are 0 of a max of 20 players online: [0m')).toEqual({
      online: 0,
      max: 20,
      players: [],
    });
  });

  test('returns no names when online count is 0, whatever follows the colon', () => {
    expect(parseRconPlayerList('There are 0 of a max of 20 players online: \x1b[1;33mjunk')).toEqual({
      online: 0,
      max: 20,
      players: [],
    });
  });

  test('returns null for unrecognized output', () => {
    expect(parseRconPlayerList('Unknown command')).toBeNull();
    expect(parseRconPlayerList('')).toBeNull();
  });

  test('uses only the first line of multi-line output', () => {
    expect(
      parseRconPlayerList('There are 1 of a max of 10 players online: Notch\n\x1b[0mGhost\n')
    ).toEqual({ online: 1, max: 10, players: ['Notch'] });
  });
});
