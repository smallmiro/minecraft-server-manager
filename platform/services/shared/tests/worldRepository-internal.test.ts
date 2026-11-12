/**
 * Worlds inside servers/<n>/data (D-1, #655): found by each server's LEVEL,
 * with the split-dimension folders Paper/Spigot keep next to it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Paths } from '../src/utils/index.js';
import { WorldRepository } from '../src/infrastructure/adapters/WorldRepository.js';
import { formatInternalWorldWarnings } from '../src/domain/services/worldAssignment.js';
import type { IContainerRuntimePort } from '../src/application/ports/index.js';

let root: string;
let repo: WorldRepository;

function server(name: string, config: string): string {
  mkdirSync(join(root, 'servers', name), { recursive: true });
  writeFileSync(join(root, 'servers', name, 'config.env'), config);
  return join(root, 'servers', name, 'data');
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-internal-'));
  repo = new WorldRepository(new Paths(root), undefined, {} as IContainerRuntimePort);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('WorldRepository.findServerInternalWorlds', () => {
  it('finds the world by LEVEL, not data/world', async () => {
    const data = server('alpha', 'LEVEL=alpha\n');
    mkdirSync(join(data, 'alpha', 'DIM-1'), { recursive: true });
    mkdirSync(join(data, 'world'), { recursive: true });

    expect(await repo.findServerInternalWorlds()).toEqual([
      { server: 'alpha', world: 'alpha', path: join(data, 'alpha'), dimensions: [], inUse: true },
    ]);
  });

  it('lists the split dimension folders of Paper/Spigot', async () => {
    const data = server('alpha', 'LEVEL=alpha\n');
    for (const d of ['alpha', 'alpha_nether', 'alpha_the_end']) mkdirSync(join(data, d), { recursive: true });

    const [found] = await repo.findServerInternalWorlds();
    expect(found?.dimensions).toEqual([join(data, 'alpha_nether'), join(data, 'alpha_the_end')]);
  });

  it('uses the default world name when LEVEL is unset', async () => {
    const data = server('alpha', 'TYPE=PAPER\n');
    mkdirSync(join(data, 'world'), { recursive: true });

    expect((await repo.findServerInternalWorlds()).map((w) => w.world)).toEqual(['world']);
  });

  it('reports a copy an earlier migrate left in data/ of a server that reads worlds/', async () => {
    const data = server('alpha', 'LEVEL=alpha\nEXTRA_ARGS=--universe /worlds/\n');
    mkdirSync(join(data, 'alpha'), { recursive: true });

    expect(await repo.findServerInternalWorlds()).toEqual([
      { server: 'alpha', world: 'alpha', path: join(data, 'alpha'), dimensions: [], inUse: false },
    ]);
  });

  it('skips servers without a world in data/ and symbolic links', async () => {
    server('fresh', 'LEVEL=fresh\n');
    server('moved', 'LEVEL=moved\nEXTRA_ARGS=--universe /worlds/\n');
    const data = server('linked', 'LEVEL=linked\n');
    mkdirSync(join(root, 'elsewhere'), { recursive: true });
    mkdirSync(data, { recursive: true });
    symlinkSync(join(root, 'elsewhere'), join(data, 'linked'));

    expect(await repo.findServerInternalWorlds()).toEqual([]);
  });
});

describe('formatInternalWorldWarnings', () => {
  it('says the server needs migration and how to run it', () => {
    const [inUse, leftover] = formatInternalWorldWarnings([
      { server: 'alpha', world: 'alpha', inUse: true },
      { server: 'beta', world: 'beta', inUse: false },
    ]);
    expect(inUse).toContain('servers/alpha/data/alpha');
    expect(inUse).toContain('needs migration');
    expect(inUse).toContain('mcctl migrate worlds --server alpha');
    expect(leftover).toContain('servers/beta/data/beta');
    expect(leftover).toContain('earlier migration');
  });
});
