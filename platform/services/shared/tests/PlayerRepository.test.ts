/**
 * TDD tests for PlayerRepository (#528, Phase 1).
 * Uses real temp-dir fixtures mirroring `servers/<name>/data/` and
 * `worlds/<level>/playerdata/` — the same layout create-server.sh produces.
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { PlayerRepository } from '../src/infrastructure/adapters/PlayerRepository.js';
import type { Paths } from '../src/utils/index.js';

async function makeTempDir(): Promise<string> {
  const dir = join(tmpdir(), `mc-player-repo-test-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(join(filePath, '..'), { recursive: true });
  await writeFile(filePath, JSON.stringify(data), 'utf-8');
}

describe('PlayerRepository', () => {
  let root: string;
  let paths: Paths;
  let repo: PlayerRepository;

  beforeEach(async () => {
    root = await makeTempDir();
    paths = { root } as unknown as Paths;
    repo = new PlayerRepository(paths);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  describe('readUserCache', () => {
    test('usercache.json을 읽는다', async () => {
      await writeJson(join(root, 'servers', 'myserver', 'data', 'usercache.json'), [
        { name: 'Steve', uuid: 'uuid-steve', expiresOn: '2099-01-01T00:00:00Z' },
      ]);

      const cache = await repo.readUserCache('myserver');
      expect(cache).toEqual([
        { name: 'Steve', uuid: 'uuid-steve', expiresOn: '2099-01-01T00:00:00Z' },
      ]);
    });

    test('파일이 없으면 빈 배열을 반환한다', async () => {
      expect(await repo.readUserCache('myserver')).toEqual([]);
    });

    test('손상된 JSON은 빈 배열을 반환한다', async () => {
      await mkdir(join(root, 'servers', 'myserver', 'data'), { recursive: true });
      await writeFile(
        join(root, 'servers', 'myserver', 'data', 'usercache.json'),
        '{not json',
        'utf-8'
      );

      expect(await repo.readUserCache('myserver')).toEqual([]);
    });
  });

  describe('listKnownPlayers', () => {
    test('usercache + ops + whitelist + bans + playerdata를 uuid로 병합한다', async () => {
      const dataDir = join(root, 'servers', 'myserver', 'data');
      await writeJson(join(dataDir, 'usercache.json'), [
        { name: 'Steve', uuid: 'uuid-steve' },
        { name: 'Alex', uuid: 'uuid-alex' },
      ]);
      await writeJson(join(dataDir, 'ops.json'), [
        { uuid: 'uuid-steve', name: 'Steve', level: 4, bypassesPlayerLimit: false },
      ]);
      await writeJson(join(dataDir, 'whitelist.json'), [
        { uuid: 'uuid-alex', name: 'Alex' },
      ]);
      await writeJson(join(dataDir, 'banned-players.json'), [
        {
          uuid: 'uuid-griefer',
          name: 'Griefer',
          reason: 'griefing',
          created: '2026-01-01T00:00:00Z',
          source: 'test',
          expires: 'forever',
        },
      ]);

      // playerdata for Steve, with a distinct mtime used as lastSeen.
      const playerDataDir = join(root, 'worlds', 'myserver', 'playerdata');
      await mkdir(playerDataDir, { recursive: true });
      const steveDat = join(playerDataDir, 'uuid-steve.dat');
      await writeFile(steveDat, '');
      const mtime = new Date('2026-03-01T00:00:00.000Z');
      await utimes(steveDat, mtime, mtime);

      const players = await repo.listKnownPlayers('myserver');
      const byName = new Map(players.map((p) => [p.name, p]));

      expect(byName.size).toBe(3);

      const steve = byName.get('Steve')!;
      expect(steve.uuid).toBe('uuid-steve');
      expect(steve.isOp).toBe(true);
      expect(steve.isWhitelisted).toBe(false);
      expect(steve.isBanned).toBe(false);
      expect(steve.online).toBe(false);
      expect(steve.lastSeen).toEqual(mtime);

      const alex = byName.get('Alex')!;
      expect(alex.isOp).toBe(false);
      expect(alex.isWhitelisted).toBe(true);
      expect(alex.lastSeen).toBeNull();

      const griefer = byName.get('Griefer')!;
      expect(griefer.isBanned).toBe(true);
    });

    test('LEVEL config.env 값으로 world 디렉터리를 찾는다', async () => {
      await writeJson(join(root, 'servers', 'myserver', 'data', 'usercache.json'), []);
      await mkdir(join(root, 'servers', 'myserver'), { recursive: true });
      await writeFile(
        join(root, 'servers', 'myserver', 'config.env'),
        'LEVEL=customworld\n',
        'utf-8'
      );

      const playerDataDir = join(root, 'worlds', 'customworld', 'playerdata');
      await mkdir(playerDataDir, { recursive: true });
      await writeFile(join(playerDataDir, 'uuid-steve.dat'), '');
      await writeJson(join(root, 'servers', 'myserver', 'data', 'ops.json'), [
        { uuid: 'uuid-steve', name: 'Steve', level: 4, bypassesPlayerLimit: false },
      ]);

      const players = await repo.listKnownPlayers('myserver');
      expect(players.map((p) => p.name)).toEqual(['Steve']);
    });

    test('LEVEL이 없으면 world 디렉터리는 서버 이름을 사용한다', async () => {
      const playerDataDir = join(root, 'worlds', 'myserver', 'playerdata');
      await mkdir(playerDataDir, { recursive: true });
      await writeFile(join(playerDataDir, 'uuid-alex.dat'), '');
      await writeJson(join(root, 'servers', 'myserver', 'data', 'ops.json'), [
        { uuid: 'uuid-alex', name: 'Alex', level: 4, bypassesPlayerLimit: false },
      ]);

      const players = await repo.listKnownPlayers('myserver');
      expect(players.map((p) => p.name)).toEqual(['Alex']);
    });

    test('모든 파일이 없으면 빈 배열을 반환한다', async () => {
      expect(await repo.listKnownPlayers('myserver')).toEqual([]);
    });
  });
});
