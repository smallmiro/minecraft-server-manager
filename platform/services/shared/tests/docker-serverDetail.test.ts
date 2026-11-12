/**
 * getServerDetailedInfo, getPlayitAgentStatus and getAvahiStatusAsync on API
 * request paths (#672): awaited docker queries only, a hang rejects.
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
import { getServerDetailedInfo, getPlayitAgentStatus } from '../src/docker/index.js';
import { RuntimeQueryTimeoutError, RuntimeUnavailableError } from '../src/application/ports/outbound/IContainerRuntimePort.js';

const STARTED = new Date(Date.now() - 125_000).toISOString();

/** execFile fake: `answer(args)` returns stdout, or null for a non-zero exit. */
function fakeExecFile(answer: (args: string[]) => string | null) {
  vi.mocked(execFile).mockImplementation(((_cmd: string, args: string[], ...rest: unknown[]) => {
    const callback = rest[rest.length - 1] as (err: Error | null, value?: unknown) => void;
    const out = answer(args);
    if (out === null) callback(Object.assign(new Error('exit 1'), { code: 1 }));
    else callback(null, { stdout: out, stderr: '' });
  }) as never);
}

function docker(args: string[]): string | null {
  if (args[0] === 'ps') return 'mc-alpha\trunning\tUp 2 minutes (healthy)\talpha.local\nmc-beta\texited\tExited (0)\t';
  if (args[0] === 'stats') return '512MiB / 2GiB,12.5%';
  if (args[0] === 'exec') return 'There are 1 of a max of 20 players online: Steve';
  if (args.includes('{{.State.StartedAt}}')) return STARTED;
  return null;
}

describe('getServerDetailedInfo (#672)', () => {
  let root: string;
  let serversDir: string;
  let worldsDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    root = mkdtempSync(join(tmpdir(), 'server-detail-'));
    serversDir = join(root, 'servers');
    worldsDir = join(root, 'worlds');
    for (const name of ['alpha', 'beta', 'gamma']) {
      mkdirSync(join(serversDir, name), { recursive: true });
      writeFileSync(join(serversDir, name, 'config.env'), 'TYPE=FABRIC\nVERSION=1.21.1\nMEMORY=4G\n');
    }
    mkdirSync(worldsDir);
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('builds a running server from one ps line plus awaited stats, uptime and players', async () => {
    fakeExecFile(docker);
    const info = await getServerDetailedInfo('alpha', serversDir, worldsDir);
    expect(spawnSync).not.toHaveBeenCalled();
    expect(execFileSync).not.toHaveBeenCalled();
    expect(info).toMatchObject({
      name: 'alpha',
      container: 'mc-alpha',
      status: 'running',
      health: 'healthy',
      hostname: 'alpha.local',
      type: 'FABRIC',
      version: '1.21.1',
      memory: '4G',
      stats: expect.objectContaining({ memoryUsage: 536870912 }),
      players: { online: 1, max: 20, players: ['Steve'] },
    });
    expect(info.uptimeSeconds).toBeGreaterThanOrEqual(120);
  });

  it('skips runtime probes for a stopped container and falls back to config for a missing one', async () => {
    fakeExecFile(docker);
    const beta = await getServerDetailedInfo('beta', serversDir, worldsDir);
    expect(beta).toMatchObject({ status: 'exited', health: 'none', hostname: '-' });
    expect(beta.stats).toBeUndefined();
    const gamma = await getServerDetailedInfo('gamma', serversDir, worldsDir);
    expect(gamma).toMatchObject({ status: 'not_created', type: 'FABRIC' });
    expect(vi.mocked(execFile).mock.calls.map(([, args]) => (args as string[])[0])).toEqual(['ps', 'ps']);
  });

  it('rejects when docker fails instead of reporting the server as not created (#669)', async () => {
    fakeExecFile(() => null);
    await expect(getServerDetailedInfo('alpha', serversDir, worldsDir)).rejects.toBeInstanceOf(RuntimeUnavailableError);
  });

  it('rejects when docker hangs instead of reporting the server as not created', async () => {
    vi.mocked(execFile).mockImplementation(((...args: unknown[]) => {
      (args[args.length - 1] as (err: Error) => void)(Object.assign(new Error('killed'), { killed: true }));
    }) as never);
    await expect(getServerDetailedInfo('alpha', serversDir, worldsDir)).rejects.toBeInstanceOf(
      RuntimeQueryTimeoutError
    );
  });
});

describe('getPlayitAgentStatus (#672)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads status and uptime through awaited queries', async () => {
    fakeExecFile((args) =>
      args.includes('{{.State.Status}}') ? 'running' : args.includes('{{.State.StartedAt}}') ? STARTED : null
    );
    const status = await getPlayitAgentStatus();
    expect(spawnSync).not.toHaveBeenCalled();
    expect(status).toMatchObject({ agentRunning: true, containerStatus: 'running' });
    expect(status.uptimeSeconds).toBeGreaterThanOrEqual(120);
  });
});
