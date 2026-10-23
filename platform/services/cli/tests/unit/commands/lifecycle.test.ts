/**
 * mcctl start/stop <server> without mcctl.sh (#734): the runtime port, and
 * BACKUP_AUTO_ON_STOP through the backup port after a stop.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ServerName,
  log,
  type ContainerStatus,
  type IContainerRuntimePort,
  type IWorldBackupPort,
  type WorldBackupStatus,
} from '@minecraft-docker/shared';
import { startCommand, stopCommand } from '../../../src/commands/lifecycle.js';

vi.mock('@minecraft-docker/shared', async () => {
  const actual = await vi.importActual<typeof import('@minecraft-docker/shared')>('@minecraft-docker/shared');
  return { ...actual, log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } };
});

const ALPHA = ServerName.fromExisting('alpha');
let root: string;

function fakeRuntime(status: ContainerStatus, action = { success: true }) {
  return {
    getStatus: vi.fn(() => status),
    start: vi.fn(async () => action),
    stop: vi.fn(async () => action),
  } as unknown as IContainerRuntimePort & Record<'getStatus' | 'start' | 'stop', ReturnType<typeof vi.fn>>;
}

function fakeBackup(status: Partial<WorldBackupStatus> = {}, pushOk = true) {
  return {
    status: vi.fn(async () => ({
      ok: true,
      value: { configured: true, branch: 'main', autoOnStop: true, ...status },
    })),
    push: vi.fn(async () =>
      pushOk
        ? { ok: true, value: { changed: true, commit: 'abc1234def', flushed: [], skipped: [], warnings: [] } }
        : { ok: false, error: { code: 'auth_failed', message: 'bad token' } }
    ),
  } as unknown as IWorldBackupPort & Record<'status' | 'push', ReturnType<typeof vi.fn>>;
}

beforeEach(() => {
  vi.mocked(log.error).mockClear();
  vi.mocked(log.warn).mockClear();
  vi.mocked(log.info).mockClear();
  root = mkdtempSync(join(tmpdir(), 'mcctl-lifecycle-'));
  writeFileSync(join(root, 'docker-compose.yml'), 'services: {}\n');
  mkdirSync(join(root, 'servers', 'alpha'), { recursive: true });
  writeFileSync(join(root, 'servers', 'alpha', 'docker-compose.yml'), 'services: {}\n');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('startCommand', () => {
  it('starts the server through the runtime port', async () => {
    const runtime = fakeRuntime('exited');

    expect(await startCommand({ root, serverName: 'alpha', runtime })).toBe(0);

    expect(runtime.start).toHaveBeenCalledWith(ALPHA);
  });

  it('starts a server whose container was never created', async () => {
    const runtime = fakeRuntime('not_found');
    expect(await startCommand({ root, serverName: 'alpha', runtime })).toBe(0);
    expect(runtime.start).toHaveBeenCalledWith(ALPHA);
  });

  it('warns and exits 2 when the server is already running', async () => {
    const runtime = fakeRuntime('running');

    expect(await startCommand({ root, serverName: 'alpha', runtime })).toBe(2);

    expect(runtime.start).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('already running'));
  });

  it('fails when the runtime cannot start it', async () => {
    const runtime = fakeRuntime('exited', { success: false, error: 'no such service' } as never);
    expect(await startCommand({ root, serverName: 'alpha', runtime })).toBe(1);
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('no such service'));
  });

  it('refuses an unknown server (no servers/<name>/docker-compose.yml)', async () => {
    const runtime = fakeRuntime('exited');
    expect(await startCommand({ root, serverName: 'ghost', runtime })).toBe(1);
    expect(runtime.start).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining("'ghost' not found"));
  });

  it('requires a server name and a valid one', async () => {
    const runtime = fakeRuntime('exited');
    expect(await startCommand({ root, runtime })).toBe(1);
    expect(await startCommand({ root, serverName: '../x', runtime })).toBe(1);
    expect(runtime.start).not.toHaveBeenCalled();
  });
});

describe('stopCommand', () => {
  it('stops the server through the runtime port', async () => {
    const runtime = fakeRuntime('running');
    const backup = fakeBackup({ autoOnStop: false });

    expect(await stopCommand({ root, serverName: 'alpha', runtime, backup })).toBe(0);

    expect(runtime.stop).toHaveBeenCalledWith(ALPHA);
    expect(backup.push).not.toHaveBeenCalled();
  });

  it('runs the auto-backup after the stop when BACKUP_AUTO_ON_STOP=true', async () => {
    const runtime = fakeRuntime('running');
    const backup = fakeBackup();

    expect(await stopCommand({ root, serverName: 'alpha', runtime, backup })).toBe(0);

    expect(backup.push).toHaveBeenCalledWith(expect.objectContaining({ lockWaitMs: 600_000 }));
    expect(runtime.stop.mock.invocationCallOrder[0]!).toBeLessThan(backup.push.mock.invocationCallOrder[0]!);
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('abc1234'));
  });

  it('a failed auto-backup does not fail the stop', async () => {
    const runtime = fakeRuntime('running');
    const backup = fakeBackup({}, false);

    expect(await stopCommand({ root, serverName: 'alpha', runtime, backup })).toBe(0);

    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('bad token'));
  });

  it.each<ContainerStatus>(['exited', 'not_found'])(
    'warns and exits 2 for a %s server without stopping or backing up',
    async (status) => {
      const runtime = fakeRuntime(status);
      const backup = fakeBackup();

      expect(await stopCommand({ root, serverName: 'alpha', runtime, backup })).toBe(2);

      expect(runtime.stop).not.toHaveBeenCalled();
      expect(backup.push).not.toHaveBeenCalled();
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('not running'));
    }
  );

  it('fails without a backup when the runtime cannot stop it', async () => {
    const runtime = fakeRuntime('running', { success: false, error: 'permission denied' } as never);
    const backup = fakeBackup();

    expect(await stopCommand({ root, serverName: 'alpha', runtime, backup })).toBe(1);

    expect(backup.status).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('permission denied'));
  });

  it('refuses an unknown server', async () => {
    const runtime = fakeRuntime('running');
    expect(await stopCommand({ root, serverName: 'ghost', runtime, backup: fakeBackup() })).toBe(1);
    expect(runtime.stop).not.toHaveBeenCalled();
  });
});
