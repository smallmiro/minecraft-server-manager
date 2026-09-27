import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { SqlitePlayerSessionRepository } from '../src/infrastructure/adapters/SqlitePlayerSessionRepository.js';

describe('SqlitePlayerSessionRepository', () => {
  let testDir: string;
  let dbPath: string;
  let repo: SqlitePlayerSessionRepository;

  beforeAll(async () => {
    testDir = join(tmpdir(), `player-session-test-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
    dbPath = join(testDir, 'test.db');
    repo = new SqlitePlayerSessionRepository(dbPath);
  });

  afterAll(async () => {
    repo.close();
    await rm(testDir, { recursive: true, force: true });
  });

  test('recordJoin then recordLeave produces one closed session', async () => {
    await repo.recordJoin('myserver', 'Steve', new Date('2026-01-01T00:00:00.000Z'));
    await repo.recordLeave('myserver', 'Steve', new Date('2026-01-01T00:10:00.000Z'));

    const sessions = await repo.listSessions('myserver', 'Steve');
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.joinedAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(sessions[0]!.leftAt?.toISOString()).toBe('2026-01-01T00:10:00.000Z');
  });

  test('recordLeave with no open session is a no-op', async () => {
    await expect(
      repo.recordLeave('myserver', 'NoOneHome', new Date('2026-01-01T00:00:00.000Z'))
    ).resolves.toBeUndefined();

    const sessions = await repo.listSessions('myserver', 'NoOneHome');
    expect(sessions).toHaveLength(0);
  });

  test('recordJoin closes a dangling open session for that player first', async () => {
    await repo.recordJoin('myserver', 'Alex', new Date('2026-01-02T00:00:00.000Z'));
    // No leave in between — simulates a missed leave event / crash.
    await repo.recordJoin('myserver', 'Alex', new Date('2026-01-02T01:00:00.000Z'));

    const sessions = await repo.listSessions('myserver', 'Alex');
    expect(sessions).toHaveLength(2);
    // Newest first.
    expect(sessions[0]!.joinedAt.toISOString()).toBe('2026-01-02T01:00:00.000Z');
    expect(sessions[0]!.leftAt).toBeNull();
    expect(sessions[1]!.joinedAt.toISOString()).toBe('2026-01-02T00:00:00.000Z');
    expect(sessions[1]!.leftAt?.toISOString()).toBe('2026-01-02T01:00:00.000Z');
  });

  test('closeOpenSessions closes every open session on a server', async () => {
    await repo.recordJoin('otherserver', 'A', new Date('2026-01-03T00:00:00.000Z'));
    await repo.recordJoin('otherserver', 'B', new Date('2026-01-03T00:00:00.000Z'));

    await repo.closeOpenSessions('otherserver', new Date('2026-01-03T01:00:00.000Z'));

    const a = await repo.listSessions('otherserver', 'A');
    const b = await repo.listSessions('otherserver', 'B');
    expect(a[0]!.leftAt?.toISOString()).toBe('2026-01-03T01:00:00.000Z');
    expect(b[0]!.leftAt?.toISOString()).toBe('2026-01-03T01:00:00.000Z');
  });

  test('player name matching is case-insensitive', async () => {
    await repo.recordJoin('caseserver', 'Steve', new Date('2026-01-04T00:00:00.000Z'));
    await repo.recordLeave('caseserver', 'STEVE', new Date('2026-01-04T00:05:00.000Z'));

    const sessions = await repo.listSessions('caseserver', 'steve');
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.leftAt).not.toBeNull();
  });

  test('listSessions respects limit and newest-first order', async () => {
    for (let i = 0; i < 3; i++) {
      await repo.recordJoin('limitserver', 'Bob', new Date(2026, 0, 5, i));
      await repo.recordLeave('limitserver', 'Bob', new Date(2026, 0, 5, i, 30));
    }

    const sessions = await repo.listSessions('limitserver', 'Bob', 2);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.joinedAt.getTime()).toBeGreaterThan(sessions[1]!.joinedAt.getTime());
  });

  test('getSummary aggregates visit count / playtime / lastSeen, counting an open session up to now', async () => {
    await repo.recordJoin('summaryserver', 'Nova', new Date('2026-01-06T00:00:00.000Z'));
    await repo.recordLeave('summaryserver', 'Nova', new Date('2026-01-06T00:10:00.000Z'));
    await repo.recordJoin('summaryserver', 'Nova', new Date('2026-01-07T00:00:00.000Z'));
    // Second session left open.

    const now = new Date('2026-01-07T00:05:00.000Z');
    const summary = await repo.getSummary('summaryserver', 'Nova', now);

    expect(summary.visitCount).toBe(2);
    expect(summary.totalPlaytimeSeconds).toBe(600 + 300);
    expect(summary.lastSeen?.toISOString()).toBe(now.toISOString());
  });

  test('getSummary returns zeroed/null result for a player with no sessions', async () => {
    const summary = await repo.getSummary('summaryserver', 'Ghost', new Date());

    expect(summary).toEqual({ visitCount: 0, totalPlaytimeSeconds: 0, lastSeen: null });
  });

  test('cursor defaults to null and can be advanced', async () => {
    expect(await repo.getCursor('cursorserver')).toBeNull();

    await repo.setCursor('cursorserver', new Date('2026-01-08T00:00:00.000Z'));
    expect((await repo.getCursor('cursorserver'))?.toISOString()).toBe(
      '2026-01-08T00:00:00.000Z'
    );

    await repo.setCursor('cursorserver', new Date('2026-01-08T01:00:00.000Z'));
    expect((await repo.getCursor('cursorserver'))?.toISOString()).toBe(
      '2026-01-08T01:00:00.000Z'
    );
  });

  test('sessions survive reopening the database (restart persistence)', async () => {
    await repo.recordJoin('restartserver', 'Persisted', new Date('2026-01-09T00:00:00.000Z'));
    await repo.recordLeave('restartserver', 'Persisted', new Date('2026-01-09T00:10:00.000Z'));

    const reopened = new SqlitePlayerSessionRepository(dbPath);
    try {
      const sessions = await reopened.listSessions('restartserver', 'Persisted');
      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.leftAt?.toISOString()).toBe('2026-01-09T00:10:00.000Z');
    } finally {
      reopened.close();
    }
  });
});
