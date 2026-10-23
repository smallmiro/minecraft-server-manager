/**
 * ServerRepository reads runtime state through an injected IContainerRuntimePort
 * (#665) and maps it to ServerStatus exactly as the old `docker inspect` did.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Paths } from '../src/utils/index.js';
import { ServerRepository } from '../src/infrastructure/adapters/ServerRepository.js';
import { ServerName, ServerStatus } from '../src/domain/index.js';
import type { IContainerRuntimePort } from '../src/application/ports/index.js';
import type { ContainerStatus } from '../src/types/index.js';

let root: string;
let status: ContainerStatus;
const runtime = { getStatus: vi.fn(() => status) } as unknown as IContainerRuntimePort;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-serverrepo-'));
  mkdirSync(join(root, 'servers', 'alpha'), { recursive: true });
  writeFileSync(join(root, 'servers', 'alpha', 'config.env'), 'TYPE=PAPER\n');
  vi.mocked(runtime.getStatus).mockClear();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('ServerRepository runtime status (#665)', () => {
  it.each([
    ['running', ServerStatus.RUNNING],
    ['exited', ServerStatus.STOPPED],
    ['dead', ServerStatus.STOPPED],
    ['not_found', ServerStatus.STOPPED],
    ['created', ServerStatus.STARTING],
    ['restarting', ServerStatus.STARTING],
    ['paused', ServerStatus.STOPPING],
    ['not_created', ServerStatus.UNKNOWN],
  ] as const)('maps %s to %s', async (state, expected) => {
    status = state;
    const repo = new ServerRepository(new Paths(root), runtime);
    expect(await repo.getStatus('alpha')).toBe(expected);
    expect((await repo.findByName('alpha'))?.status).toBe(expected);
  });

  it('asks the port by ServerName, not by container name', async () => {
    status = 'running';
    await new ServerRepository(new Paths(root), runtime).getStatus('alpha');
    expect(runtime.getStatus).toHaveBeenCalledWith(ServerName.fromExisting('alpha'));
  });
});
