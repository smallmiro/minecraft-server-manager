/**
 * #735 review: FileServerSpecRepository.delete failing after the world moved.
 * The world move stays outside the servers/compose.yml lock (a long copy must
 * not make other writers time out), so a failure after it says what already
 * moved and what is left. Temp MCCTL_ROOT; no docker, no sudo.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, rm: vi.fn(actual.rm) };
});

import { rm } from 'node:fs/promises';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir, uptime } from 'node:os';
import { join } from 'node:path';
import { Paths } from '../src/utils/index.js';
import { ServerSpecError } from '../src/domain/server-spec/ServerSpecDocument.js';
import {
  FileServerSpecRepository,
  serverSpecTestHooks,
} from '../src/infrastructure/adapters/server-spec/FileServerSpecRepository.js';
import { includeEntries } from '../src/infrastructure/adapters/server-spec/DockerComposeRenderer.js';

let root: string;
let repo: FileServerSpecRepository;
const defaultHooks = { ...serverSpecTestHooks };
const at = (...p: string[]) => join(root, ...p);
const compose = () => readFileSync(at('servers', 'compose.yml'), 'utf-8');
const rejection = (p: Promise<unknown>) => p.then(() => expect.fail('delete succeeded'), (e: unknown) => e as ServerSpecError);
const MOVED = 'Already moved: servers/alpha/data/alpha -> worlds/alpha';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-spec-delete-partial-'));
  mkdirSync(at('servers', 'alpha', 'data', 'alpha'), { recursive: true });
  mkdirSync(at('worlds'));
  writeFileSync(at('servers', 'alpha', 'config.env'), 'LEVEL=alpha\n');
  writeFileSync(at('servers', 'alpha', 'data', 'alpha', 'level.dat'), 'level');
  writeFileSync(at('servers', 'compose.yml'), 'include:\n  - alpha/docker-compose.yml\n  - beta/docker-compose.yml\n');
  repo = new FileServerSpecRepository(new Paths(root), undefined, undefined, () => []);
});

afterEach(() => {
  Object.assign(serverSpecTestHooks, defaultHooks);
  vi.mocked(rm).mockClear();
  rmSync(root, { recursive: true, force: true });
});

describe('delete: a failure after the world moved says what moved', () => {
  it('servers/compose.yml locked by another process: names the moved world, keeps servers/alpha/', async () => {
    const holder = {
      pid: process.pid,
      hostname: hostname(),
      bootTime: Math.round(Date.now() - uptime() * 1000),
      nonce: 'someone-else',
      op: 'compose-include',
      startedAt: new Date().toISOString(),
    };
    writeFileSync(at('servers', '.compose.yml.lock'), JSON.stringify(holder));
    serverSpecTestHooks.includeLockWaitMs = 50;

    const error = await rejection(repo.delete('alpha'));
    expect(error.code).toBe('locked');
    expect(error.message).toMatch(/servers\/compose.yml is locked/);
    expect(error.message).toContain('servers/alpha/ was kept.');
    expect(error.message).toContain(MOVED);
    expect(readFileSync(at('worlds', 'alpha', 'level.dat'), 'utf-8')).toBe('level');
    expect(existsSync(at('servers', 'alpha', 'config.env'))).toBe(true);
    expect(includeEntries(compose())).toContain('alpha/docker-compose.yml');
  });

  it('servers/compose.yml broken while the world moved: names the moved world, keeps servers/alpha/', async () => {
    serverSpecTestHooks.beforeWorldMove = async () => writeFileSync(at('servers', 'compose.yml'), 'include: [alpha\n');

    const error = await rejection(repo.delete('alpha'));
    expect(error.code).toBe('conflict');
    expect(error.message).toMatch(/servers\/compose.yml does not parse/);
    expect(error.message).toContain(MOVED);
    expect(existsSync(at('worlds', 'alpha', 'level.dat'))).toBe(true);
    expect(existsSync(at('servers', 'alpha', 'config.env'))).toBe(true);
  });
});

describe('delete: servers/<n>/ is removed after the include entry, outside the lock', () => {
  it('runs rm without holding the servers/compose.yml lock', async () => {
    const lockHeld: boolean[] = [];
    vi.mocked(rm).mockImplementationOnce(async (...args) => {
      lockHeld.push(existsSync(at('servers', '.compose.yml.lock')));
      const { rm: realRm } = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
      return realRm(...args);
    });

    await repo.delete('alpha');
    expect(lockHeld).toEqual([false]);
    expect(existsSync(at('servers', 'alpha'))).toBe(false);
  });

  it('a server directory that cannot be fully removed is a warning: the server is out of the include, clean up the rest', async () => {
    vi.mocked(rm).mockRejectedValueOnce(Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' }));

    const result = await repo.delete('alpha');
    expect(result).toMatchObject({ level: 'alpha', movedWorlds: ['alpha'], deletedWorlds: [] });
    expect(result.warning).toBe(
      'servers/alpha/ was removed from servers/compose.yml but could not be fully deleted (EACCES: permission denied); ' +
        `remove what is left with: sudo rm -rf '${at('servers', 'alpha')}'`
    );
    expect(includeEntries(compose())).toEqual(['beta/docker-compose.yml']);
    expect(existsSync(at('worlds', 'alpha', 'level.dat'))).toBe(true);
  });
});
