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

/** Another live mcctl process holds servers/compose.yml. */
function holdIncludeLock(): void {
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
}

/** A second world folder, so a move can fail after the first one moved. */
function addNether(): void {
  mkdirSync(at('servers', 'alpha', 'data', 'alpha_nether'), { recursive: true });
  writeFileSync(at('servers', 'alpha', 'data', 'alpha_nether', 'level.dat'), 'nether');
}

describe('delete: the include entry goes before the world moves (#735 review)', () => {
  it('is already gone from servers/compose.yml when the move starts, so compose up cannot recreate the server', async () => {
    const atMove: string[][] = [];
    serverSpecTestHooks.beforeWorldMove = async () => {
      atMove.push(includeEntries(compose()));
    };
    await repo.delete('alpha');
    expect(atMove).toEqual([['beta/docker-compose.yml']]);
  });

  it('a lock held by another process fails before anything moves, with its code', async () => {
    holdIncludeLock();
    const error = await rejection(repo.delete('alpha'));
    expect(error.code).toBe('locked');
    expect(error.message).toMatch(/servers\/compose.yml is locked/);
    expect(existsSync(at('servers', 'alpha', 'data', 'alpha', 'level.dat'))).toBe(true);
    expect(existsSync(at('worlds', 'alpha'))).toBe(false);
    expect(includeEntries(compose())).toContain('alpha/docker-compose.yml');
  });
});

describe('delete: a failed move puts the include entry back (#735 review)', () => {
  it('restores servers/compose.yml exactly when nobody changed it meanwhile', async () => {
    addNether();
    const original =
      '# hand-written\ninclude:\n  - path: [alpha/docker-compose.yml, beta/docker-compose.yml]\n    project_directory: .\n';
    writeFileSync(at('servers', 'compose.yml'), original);
    serverSpecTestHooks.beforeWorldMove = async (world) => {
      if (world === 'alpha_nether') mkdirSync(at('worlds', 'alpha_nether')); // another process takes the name
    };

    const error = await rejection(repo.delete('alpha'));
    expect(error.code).toBe('conflict');
    expect(error.message).toMatch(/worlds\/alpha_nether appeared/);
    expect(error.message).toContain(MOVED);
    expect(error.message).not.toMatch(/add it back/);
    expect(compose()).toBe(original);
  });

  it('adds the entry back when another process changed servers/compose.yml meanwhile', async () => {
    serverSpecTestHooks.beforeWorldMove = async () => {
      writeFileSync(at('servers', 'compose.yml'), `${compose()}  - gamma/docker-compose.yml\n`);
      mkdirSync(at('worlds', 'alpha'));
    };

    await expect(repo.delete('alpha')).rejects.toThrow(/worlds\/alpha appeared/);
    expect(includeEntries(compose()).sort()).toEqual(['alpha/docker-compose.yml', 'beta/docker-compose.yml', 'gamma/docker-compose.yml']);
  });

  it('leaves an entry another process already put back alone', async () => {
    serverSpecTestHooks.beforeWorldMove = async () => {
      writeFileSync(at('servers', 'compose.yml'), 'include:\n  - alpha/docker-compose.yml\n');
      mkdirSync(at('worlds', 'alpha'));
    };
    await expect(repo.delete('alpha')).rejects.toThrow(/worlds\/alpha appeared/);
    expect(compose()).toBe('include:\n  - alpha/docker-compose.yml\n');
  });

  it.each([
    ['servers/compose.yml stopped parsing', () => writeFileSync(at('servers', 'compose.yml'), 'include: [alpha\n')],
    ['the lock is held by another process', holdIncludeLock],
  ])('a restore that fails (%s) says how to add the entry back, keeping the move error', async (_, breakRestore) => {
    addNether();
    serverSpecTestHooks.beforeWorldMove = async (world) => {
      if (world !== 'alpha_nether') return;
      breakRestore();
      mkdirSync(at('worlds', 'alpha_nether'));
    };

    const error = await rejection(repo.delete('alpha'));
    expect(error.code).toBe('conflict');
    expect(error.message).toMatch(/^worlds\/alpha_nether appeared before data\/alpha_nether could be moved\. servers\/alpha\/ was kept\./);
    expect(error.message).toContain(MOVED);
    expect(error.message).toMatch(
      /servers\/compose.yml no longer includes alpha\/docker-compose.yml and putting it back failed \(.+\); add "- alpha\/docker-compose.yml" under include: in servers\/compose.yml to start the server again/
    );
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
