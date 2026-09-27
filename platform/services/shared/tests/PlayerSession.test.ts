import { describe, it, expect } from 'vitest';
import { PlayerSession } from '../src/domain/entities/PlayerSession.js';

describe('PlayerSession', () => {
  it('exposes join/leave data', () => {
    const session = PlayerSession.create({
      id: 1,
      serverName: 'myserver',
      playerName: 'Steve',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
      leftAt: new Date('2026-01-01T00:10:00.000Z'),
    });

    expect(session.id).toBe(1);
    expect(session.serverName).toBe('myserver');
    expect(session.playerName).toBe('Steve');
    expect(session.joinedAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(session.leftAt?.toISOString()).toBe('2026-01-01T00:10:00.000Z');
  });

  it('id is optional (not yet persisted)', () => {
    const session = PlayerSession.create({
      serverName: 'myserver',
      playerName: 'Steve',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
      leftAt: null,
    });

    expect(session.id).toBeUndefined();
  });

  describe('durationSeconds', () => {
    it('computes the closed-session duration', () => {
      const session = PlayerSession.create({
        serverName: 'myserver',
        playerName: 'Steve',
        joinedAt: new Date('2026-01-01T00:00:00.000Z'),
        leftAt: new Date('2026-01-01T00:10:00.000Z'),
      });

      expect(session.durationSeconds(new Date('2026-01-02T00:00:00.000Z'))).toBe(600);
    });

    it('counts an open session up to `now`', () => {
      const session = PlayerSession.create({
        serverName: 'myserver',
        playerName: 'Steve',
        joinedAt: new Date('2026-01-01T00:00:00.000Z'),
        leftAt: null,
      });

      expect(session.durationSeconds(new Date('2026-01-01T00:05:00.000Z'))).toBe(300);
    });
  });

  it('serializes to JSON', () => {
    const session = PlayerSession.create({
      id: 2,
      serverName: 'myserver',
      playerName: 'Steve',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
      leftAt: null,
    });

    expect(session.toJSON()).toEqual({
      id: 2,
      serverName: 'myserver',
      playerName: 'Steve',
      joinedAt: '2026-01-01T00:00:00.000Z',
      leftAt: null,
    });
  });
});
