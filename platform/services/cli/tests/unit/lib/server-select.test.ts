/**
 * The server prompt of `mcctl player` lists servers through the runtime
 * port (#668, ADR-0001 row 13) instead of `docker ps -a`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServerName, type ContainerStatus } from '@minecraft-docker/shared';

const statuses: Record<string, ContainerStatus> = {
  alpha: 'running',
  beta: 'paused',
  gamma: 'exited',
};
const runtime = {
  list: vi.fn(() => ['mc-alpha', 'mc-beta', 'mc-gamma']),
  getStatus: vi.fn((name: ServerName | string) => statuses[(name as ServerName).value] ?? 'not_found'),
};

vi.mock('../../../src/infrastructure/index.js', () => ({
  getContainer: () => ({ containerRuntime: runtime }),
}));

import { getServerList } from '../../../src/lib/prompts/server-select.js';

beforeEach(() => {
  runtime.list.mockClear();
  runtime.getStatus.mockClear();
});

describe('getServerList', () => {
  it('lists every server workload with its state', async () => {
    await expect(getServerList()).resolves.toEqual([
      { name: 'alpha', containerName: 'mc-alpha', status: 'running' },
      // "Up (Paused)" counted as running, as the docker ps status did
      { name: 'beta', containerName: 'mc-beta', status: 'running' },
      { name: 'gamma', containerName: 'mc-gamma', status: 'stopped' },
    ]);
    expect(runtime.list).toHaveBeenCalledWith();
    expect(runtime.getStatus.mock.calls[0]![0]).toBeInstanceOf(ServerName);
  });

  it('returns [] when the runtime cannot be listed', async () => {
    runtime.list.mockImplementationOnce(() => {
      throw new Error('docker ps failed');
    });

    await expect(getServerList()).resolves.toEqual([]);
  });
});
