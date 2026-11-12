/**
 * A server whose config cannot become a Server is reported as invalid, not as
 * "not found" (#657): delete must not say a visible directory does not exist.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Paths } from '../src/utils/index.js';
import { ServerRepository, InvalidServerConfigError } from '../src/infrastructure/adapters/ServerRepository.js';
import type { IContainerRuntimePort } from '../src/application/ports/index.js';

let root: string;
const runtime = { getStatusAsync: async () => 'running' } as unknown as IContainerRuntimePort;
const write = (name: string, env: string) => {
  mkdirSync(join(root, 'servers', name), { recursive: true });
  writeFileSync(join(root, 'servers', name, 'config.env'), env);
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-invalid-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('ServerRepository invalid configs (#657)', () => {
  it('findByName throws InvalidServerConfigError for an invalid MEMORY', async () => {
    write('bad', 'TYPE=PAPER\nMEMORY=banana\n');
    const repo = new ServerRepository(new Paths(root), runtime);
    await expect(repo.findByName('bad')).rejects.toBeInstanceOf(InvalidServerConfigError);
    await expect(repo.findByName('bad')).rejects.toThrow(/bad.*invalid/i);
  });

  it('findByName throws for an invalid WORLD_URL', async () => {
    write('bad', 'WORLD_URL=ftp://x/y.zip\n');
    await expect(new ServerRepository(new Paths(root), runtime).findByName('bad')).rejects.toBeInstanceOf(
      InvalidServerConfigError
    );
  });

  it('findByName still returns null for a server that does not exist', async () => {
    expect(await new ServerRepository(new Paths(root), runtime).findByName('nope')).toBeNull();
  });

  it('findAll skips the invalid server and keeps the valid ones', async () => {
    write('bad', 'MEMORY=banana\n');
    write('good', 'TYPE=PAPER\n');
    const all = await new ServerRepository(new Paths(root), runtime).findAll();
    expect(all.map((s) => s.name.value)).toEqual(['good']);
  });
});
