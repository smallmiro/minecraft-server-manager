import { describe, it, expect } from 'vitest';
import { parsePlayerSessionEvent } from '../src/domain/index.js';

describe('parsePlayerSessionEvent', () => {
  it('parses a join line (vanilla/Paper format, docker --timestamps prefix)', () => {
    const line =
      '2026-09-27T08:13:49.123456789Z [08:13:49] [Server thread/INFO]: Steve joined the game';

    const event = parsePlayerSessionEvent(line);

    expect(event).toEqual({
      type: 'join',
      playerName: 'Steve',
      at: new Date('2026-09-27T08:13:49.123Z'),
    });
  });

  it('parses a leave line', () => {
    const line =
      '2026-09-27T08:20:00.000000000Z [08:20:00] [Server thread/INFO]: Steve left the game';

    const event = parsePlayerSessionEvent(line);

    expect(event).toEqual({
      type: 'leave',
      playerName: 'Steve',
      at: new Date('2026-09-27T08:20:00.000Z'),
    });
  });

  it('ignores unrelated log lines', () => {
    const line = '2026-09-27T08:13:49.000000000Z [08:13:49] [Server thread/INFO]: Done (12.3s)!';

    expect(parsePlayerSessionEvent(line)).toBeNull();
  });

  it('does not match chat spoofing a join/leave message', () => {
    const line =
      '2026-09-27T08:13:49.000000000Z [08:13:49] [Server thread/INFO]: <Steve> Alex joined the game';

    expect(parsePlayerSessionEvent(line)).toBeNull();
  });

  it('ignores blank/empty lines', () => {
    expect(parsePlayerSessionEvent('')).toBeNull();
    expect(parsePlayerSessionEvent('   ')).toBeNull();
  });

  it('ignores lines with no docker timestamp prefix', () => {
    const line = '[08:13:49] [Server thread/INFO]: Steve joined the game';

    expect(parsePlayerSessionEvent(line)).toBeNull();
  });
});
