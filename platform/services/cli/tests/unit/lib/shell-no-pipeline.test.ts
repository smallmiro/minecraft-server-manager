import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

const mockSpawn = vi.fn();
const mockExecFile = vi.fn();
vi.mock('node:child_process', () => ({
  spawn: (...a: any[]) => mockSpawn(...a),
  execFile: (...a: any[]) => mockExecFile(...a),
}));
vi.mock('@minecraft-docker/shared', () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  Paths: vi.fn().mockImplementation(() => ({ root: '/tmp/r', servers: '/tmp/r/servers', templates: '/tmp/r/t' })),
}));
vi.mock('@minecraft-docker/shared/utils', () => ({
  assertEnvFileValue: vi.fn(),
  parseEnvDocument: vi.fn(),
}));
vi.mock('../../../src/lib/server-config.js', () => ({ writeServerConfig: vi.fn() }));

import { ShellExecutor } from '../../../src/infrastructure/ShellExecutor.js';

/** execFile answers by "docker <args>" key; spawn exit codes by key too. */
function setup(out: Record<string, string | Error>, exit: Record<string, number> = {}) {
  mockExecFile.mockImplementation((_c: string, args: string[], _o: any, cb?: any) => {
    const done = typeof _o === 'function' ? _o : cb;
    const r = out[args.join(' ')];
    if (r instanceof Error) done(r, '');
    else done(null, r ?? '');
  });
  mockSpawn.mockImplementation((_c: string, args: string[]) => {
    const child = new EventEmitter();
    setImmediate(() => child.emit('close', exit[args.join(' ')] ?? 0));
    return child;
  });
}
const spawned = () => mockSpawn.mock.calls.map((c) => [c[0], ...c[1]].join(' '));

describe('ShellExecutor runs no sh pipelines (#657)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stopAll fails when listing services fails, instead of reporting success', async () => {
    setup({ 'compose config --services': new Error('boom') });
    expect(await new ShellExecutor().stopAll()).toBe(1);
    expect(spawned()).toEqual([]);
  });

  it('stopAll stops only mc-* services and returns the compose exit code', async () => {
    setup({ 'compose config --services': 'router\nmc-a\nmc-b\n' }, { 'compose stop mc-a mc-b': 3 });
    expect(await new ShellExecutor().stopAll()).toBe(3);
    expect(spawned()).toEqual(['docker compose stop mc-a mc-b']);
  });

  it('startAll with no mc-* services succeeds without running compose', async () => {
    setup({ 'compose config --services': 'router\n' });
    expect(await new ShellExecutor().startAll()).toBe(0);
    expect(spawned()).toEqual([]);
  });

  it('down stops containers one by one, still runs compose down, and reports a stop failure', async () => {
    setup({ 'ps --filter name=mc- --format {{.Names}}': 'mc-a\nmc-b\n' }, { 'stop mc-a': 1 });
    expect(await new ShellExecutor().down()).toBe(1);
    expect(spawned()).toEqual(['docker stop mc-a', 'docker stop mc-b', 'docker compose down']);
  });
});
