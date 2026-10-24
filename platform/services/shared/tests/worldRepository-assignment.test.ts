/**
 * WorldRepository reads "locked" from the LEVEL-derived assignments, not
 * worlds/.locks (#670, ADR-0002): isLocked/lockedBy now mean "assigned".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Paths } from '../src/utils/index.js';
import { WorldRepository } from '../src/infrastructure/adapters/WorldRepository.js';
import { ConfigEnvWorldAssignmentAdapter } from '../src/infrastructure/adapters/ConfigEnvWorldAssignmentAdapter.js';
import type { IContainerRuntimePort, IWorldAssignmentPort } from '../src/application/ports/index.js';
import type { ContainerStatus } from '../src/types/index.js';

// Injected runtime (#665); was a mock of the facade's getContainerStatus
const containerStatus = { value: 'not_found' as ContainerStatus };
const runtime = { getStatus: vi.fn(() => containerStatus.value) } as unknown as IContainerRuntimePort;

let root: string;
let repo: WorldRepository;

function server(name: string, level: string, universe = true): void {
  mkdirSync(join(root, 'servers', name), { recursive: true });
  writeFileSync(
    join(root, 'servers', name, 'config.env'),
    `LEVEL=${level}\n${universe ? 'EXTRA_ARGS=--universe /worlds/\n' : ''}`
  );
}

function world(name: string): void {
  mkdirSync(join(root, 'worlds', name), { recursive: true });
}

function lockFile(world: string, holder: string): string {
  mkdirSync(join(root, 'worlds', '.locks'), { recursive: true });
  const file = join(root, 'worlds', '.locks', `${world}.lock`);
  writeFileSync(file, `${holder}:${Math.floor(Date.now() / 1000)}:1\n`);
  return file;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-worldrepo-'));
  repo = new WorldRepository(new Paths(root), undefined, runtime);
  containerStatus.value = 'not_found';
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('WorldRepository assignment hydration', () => {
  it('marks a world as locked by the server whose LEVEL points at it', async () => {
    world('shared');
    server('alpha', 'shared');

    const found = await repo.findByName('shared');
    expect(found?.isLocked).toBe(true);
    expect(found?.lockedBy).toBe('alpha');
  });

  it('ignores worlds/.locks: a lock file alone does not lock, a missing one does not unlock', async () => {
    world('stale');
    world('held');
    lockFile('stale', 'ghost');
    server('alpha', 'held');

    expect((await repo.findByName('stale'))?.isLocked).toBe(false);
    expect((await repo.findByName('held'))?.lockedBy).toBe('alpha');
  });

  it('counts a server-internal holder (it reserves the name)', async () => {
    world('old');
    server('old', 'old', false);
    expect((await repo.findByName('old'))?.lockedBy).toBe('old');
  });

  it('findAll reads one snapshot per call', async () => {
    world('a');
    world('b');
    const port: IWorldAssignmentPort = {
      snapshot: vi.fn().mockResolvedValue({
        assignments: [{ world: 'a', server: 'srv', internal: false }],
        undetermined: [],
      }),
      assign: vi.fn(),
      release: vi.fn(),
    };
    repo = new WorldRepository(new Paths(root), port, runtime);

    const worlds = await repo.findAll();

    expect(port.snapshot).toHaveBeenCalledTimes(1);
    expect(worlds.map((w) => [w.name, w.lockedBy])).toEqual(
      expect.arrayContaining([
        ['a', 'srv'],
        ['b', undefined],
      ])
    );
  });

  it('lists worlds as unassigned when servers/ cannot be read', async () => {
    world('a');
    const port: IWorldAssignmentPort = {
      snapshot: vi.fn().mockRejectedValue(new Error('EACCES')),
      assign: vi.fn(),
      release: vi.fn(),
    };
    repo = new WorldRepository(new Paths(root), port, runtime);

    expect((await repo.findAll()).map((w) => w.isLocked)).toEqual([false]);
  });

  it('findUnlocked/findLocked follow the assignments', async () => {
    world('free');
    world('held');
    server('alpha', 'held');

    expect((await repo.findUnlocked()).map((w) => w.name)).toEqual(['free']);
    expect((await repo.findLocked()).map((w) => w.name)).toEqual(['held']);
  });

  it('findAllWithServerStatus treats an assigned world without a container as stopped, not available', async () => {
    world('free');
    world('held');
    server('alpha', 'held');

    const results = await repo.findAllWithServerStatus();

    expect(results.map((r) => [r.world.name, r.category, r.serverStatus])).toEqual([
      ['free', 'available', undefined],
      ['held', 'stopped', 'stopped'],
    ]);
  });

  it('findAllWithServerStatus reports a running holder', async () => {
    world('held');
    server('alpha', 'held');
    containerStatus.value = 'running';

    const [result] = await repo.findAllWithServerStatus();
    expect(result).toMatchObject({ category: 'running', assignedServer: 'alpha', serverStatus: 'running' });
    expect(runtime.getStatus).toHaveBeenCalledWith('mc-alpha');
  });

  it('delete leaves worlds/.locks alone', async () => {
    world('gone');
    const file = lockFile('gone', 'ghost');

    expect(await repo.delete('gone')).toBe(true);
    expect(existsSync(join(root, 'worlds', 'gone'))).toBe(false);
    expect(existsSync(file)).toBe(true);
  });
});
