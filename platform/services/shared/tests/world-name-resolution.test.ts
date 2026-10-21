import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// No docker in unit tests: every container looks stopped.
vi.mock('../src/docker/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/docker/index.js')>();
  return {
    ...actual,
    execCommandAsync: vi.fn().mockResolvedValue({ code: 1, stdout: '', stderr: '' }),
  };
});

import { getDetailedServerInfoFromConfig } from '../src/docker/index.js';
import { ServerRepository } from '../src/infrastructure/adapters/ServerRepository.js';
import { Paths } from '../src/utils/index.js';

describe('world name resolution (#649)', () => {
  let root: string;

  async function addServer(name: string, configEnv: string): Promise<void> {
    await mkdir(join(root, 'servers', name), { recursive: true });
    await writeFile(join(root, 'servers', name, 'config.env'), configEnv);
  }

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'world-name-resolution-'));
    await mkdir(join(root, 'worlds'), { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('config-only server info uses LEVEL like running-server info does', async () => {
    await addServer('srv', 'TYPE=PAPER\nLEVEL=shared-world\n');

    const info = await getDetailedServerInfoFromConfig(
      'srv',
      join(root, 'servers'),
      join(root, 'worlds')
    );

    expect(info.worldName).toBe('shared-world');
  });

  it('ServerRepository reads the world from LEVEL, not the WORLD download URL', async () => {
    await addServer('dl', 'TYPE=PAPER\nLEVEL=dl\nWORLD=https://example.com/world.zip\n');

    const repo = new ServerRepository(new Paths(root));
    expect((await repo.getConfig('dl'))?.worldName).toBe('dl');

    const server = await repo.findByName('dl');
    expect(server).not.toBeNull();
    expect(server?.worldOptions.worldName).toBe('dl');
  });

  it('ServerRepository keeps servers whose LEVEL is not a valid new world name', async () => {
    await addServer('legacy-level', 'TYPE=PAPER\nLEVEL=My World\n');

    const server = await new ServerRepository(new Paths(root)).findByName('legacy-level');
    expect(server).not.toBeNull();
  });

  it('ServerRepository keeps existing servers whose names predate the strict rule', async () => {
    await addServer('a', 'TYPE=PAPER\n');
    await addServer('router', 'TYPE=PAPER\n');

    const repo = new ServerRepository(new Paths(root));
    expect((await repo.findByName('a'))?.name.value).toBe('a');
    expect((await repo.findByName('router'))?.name.value).toBe('router');
  });
});
