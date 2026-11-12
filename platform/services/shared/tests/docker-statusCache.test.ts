/**
 * Async status queries for API request paths (#672): every status, health and
 * existence check reads one shared `docker ps` snapshot, cached briefly and
 * fetched once for concurrent callers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
  execFileSync: vi.fn(),
  execSync: vi.fn(),
  spawn: vi.fn(),
  execFile: vi.fn(),
}));

import { spawnSync, execFileSync, execFile } from 'node:child_process';
import {
  containerExistsAsync,
  getAllServersAsync,
  getContainerHealthAsync,
  getContainerStatusAsync,
  getServerInfoFromConfigAsync,
  invalidateContainerStates,
  serverExistsAsync,
} from '../src/docker/index.js';
import {
  RuntimeQueryTimeoutError,
  RuntimeUnavailableError,
} from '../src/application/ports/outbound/IContainerRuntimePort.js';

const PS =
  // discovery columns first (#674): name, io.mcctl.role, compose project, compose service
  'mc-router\trouter\tminecraft\trouter\trunning\tUp 1 hour\t\n' +
  'mc-alpha\tserver\tminecraft\tmc-alpha\trunning\tUp 2 minutes (healthy)\talpha.local\n' +
  'mc-orphan\tserver\tminecraft\tmc-orphan\texited\tExited (0) 3 days ago\t';

type Answer = (args: string[]) => string | null | 'hang' | 'timeout';

/** execFile fake: stdout, null for a non-zero exit, 'timeout' for a killed child, 'hang' never answers. */
function fakeExecFile(answer: Answer) {
  vi.mocked(execFile).mockImplementation(((_cmd: string, args: string[], ...rest: unknown[]) => {
    const callback = rest[rest.length - 1] as (err: Error | null, value?: unknown) => void;
    const out = answer(args);
    if (out === 'hang') return;
    if (out === 'timeout') callback(Object.assign(new Error('killed'), { killed: true }));
    else if (out === null) callback(Object.assign(new Error('exit 1'), { code: 1 }));
    else callback(null, { stdout: out, stderr: '' });
  }) as never);
}

const psCalls = () => vi.mocked(execFile).mock.calls.filter(call => (call[1] as string[])[0] === 'ps').length;

describe('cached docker status snapshot (#672)', () => {
  let root: string;
  let serversDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    invalidateContainerStates();
    root = mkdtempSync(join(tmpdir(), 'status-cache-'));
    serversDir = join(root, 'servers');
    for (const name of ['alpha', 'beta']) {
      mkdirSync(join(serversDir, name), { recursive: true });
      writeFileSync(join(serversDir, name, 'config.env'), 'TYPE=PAPER\n');
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(root, { recursive: true, force: true });
  });

  it('answers status, health and existence from one ps snapshot, never spawnSync', async () => {
    fakeExecFile(() => PS);
    expect(await getContainerStatusAsync('mc-alpha')).toBe('running');
    expect(await getContainerStatusAsync('mc-beta')).toBe('not_found');
    expect(await getContainerHealthAsync('mc-alpha')).toBe('healthy');
    expect(await getContainerHealthAsync('mc-beta')).toBe('unknown');
    expect(await containerExistsAsync('mc-orphan')).toBe(true);
    expect(await containerExistsAsync('mc-beta')).toBe(false);
    expect(psCalls()).toBe(1);
    expect(spawnSync).not.toHaveBeenCalled();
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it('runs one ps for concurrent callers', async () => {
    fakeExecFile(() => PS);
    await Promise.all([getContainerStatusAsync('mc-alpha'), getContainerStatusAsync('mc-orphan'), containerExistsAsync('mc-x')]);
    expect(psCalls()).toBe(1);
  });

  it('queries again after the TTL and after invalidateContainerStates()', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    fakeExecFile(() => PS);
    await getContainerStatusAsync('mc-alpha');
    vi.setSystemTime(Date.now() + 1_000);
    await getContainerStatusAsync('mc-alpha');
    expect(psCalls()).toBe(1);
    vi.setSystemTime(Date.now() + 5_000);
    await getContainerStatusAsync('mc-alpha');
    expect(psCalls()).toBe(2);
    invalidateContainerStates();
    await getContainerStatusAsync('mc-alpha');
    expect(psCalls()).toBe(3);
  });

  it('rejects on a timeout and does not cache it', async () => {
    fakeExecFile(() => 'timeout');
    await expect(getContainerStatusAsync('mc-alpha')).rejects.toBeInstanceOf(RuntimeQueryTimeoutError);
    fakeExecFile(() => PS);
    expect(await getContainerStatusAsync('mc-alpha')).toBe('running');
  });

  it('rejects on a failed docker instead of reading it as no containers, and does not cache it (#669)', async () => {
    fakeExecFile(() => null);
    await expect(getContainerStatusAsync('mc-alpha')).rejects.toBeInstanceOf(RuntimeUnavailableError);
    await expect(getServerInfoFromConfigAsync('alpha')).rejects.toBeInstanceOf(RuntimeUnavailableError);
    await expect(getAllServersAsync(serversDir)).rejects.toBeInstanceOf(RuntimeUnavailableError);
    // A configured server still answers without docker
    expect(await serverExistsAsync('alpha', serversDir)).toBe(true);
    await expect(serverExistsAsync('nope', serversDir)).rejects.toBeInstanceOf(RuntimeUnavailableError);
    fakeExecFile(() => PS);
    expect(await getContainerStatusAsync('mc-alpha')).toBe('running');
  });

  it('builds server info and the merged server list from the snapshot', async () => {
    fakeExecFile(() => PS);
    expect(await getServerInfoFromConfigAsync('alpha')).toEqual({
      name: 'alpha',
      container: 'mc-alpha',
      status: 'running',
      health: 'healthy',
      hostname: 'alpha.local',
    });
    expect(await getServerInfoFromConfigAsync('beta')).toEqual({
      name: 'beta',
      container: 'mc-beta',
      status: 'not_created',
      health: 'none',
      hostname: '-',
    });
    expect(await getAllServersAsync(serversDir)).toEqual(['alpha', 'beta', 'orphan']);
  });

  it('serverExistsAsync answers a configured server without docker', async () => {
    fakeExecFile(() => 'hang');
    expect(await serverExistsAsync('alpha', serversDir)).toBe(true);
    expect(psCalls()).toBe(0);
    fakeExecFile(() => PS);
    expect(await serverExistsAsync('orphan', serversDir)).toBe(true);
    expect(await serverExistsAsync('nope', serversDir)).toBe(false);
  });
});
