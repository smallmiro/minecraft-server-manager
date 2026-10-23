/**
 * Auto-backup after a server stop (BACKUP_AUTO_ON_STOP, #734). Replaces the
 * `mcctl.sh stop` branch; the CLI and API stop paths share it (#732 B-Q9).
 */
import { describe, test, expect, vi } from 'vitest';
import {
  autoBackupOnStop,
  AUTO_BACKUP_LOCK_WAIT_MS,
  AUTO_BACKUP_CLOSE_WAIT_MS,
  API_PM2_KILL_TIMEOUT_MS,
} from '../src/application/use-cases/autoBackupOnStop.js';
import type { IWorldBackupPort, WorldBackupStatus } from '../src/application/ports/index.js';

function fakeBackup(status: Partial<WorldBackupStatus> | Error, push?: IWorldBackupPort['push']) {
  return {
    status: vi.fn(async () =>
      status instanceof Error
        ? { ok: false as const, error: { code: 'io_failed' as const, message: status.message } }
        : { ok: true as const, value: { configured: true, branch: 'main', autoOnStop: true, ...status } }
    ),
    push: vi.fn(
      push ?? (async () => ({ ok: true as const, value: { changed: true, commit: 'abc1234', flushed: [], skipped: [], warnings: [] } }))
    ),
  } as unknown as IWorldBackupPort & { status: ReturnType<typeof vi.fn>; push: ReturnType<typeof vi.fn> };
}

describe('autoBackupOnStop', () => {
  test('pushes like `mcctl backup push --auto`: waits for the lock, never asks to drop worlds', async () => {
    const backup = fakeBackup({});

    const result = await autoBackupOnStop(backup, 'alpha');

    expect(result).toMatchObject({ status: 'done', outcome: { commit: 'abc1234' } });
    expect(backup.push).toHaveBeenCalledTimes(1);
    const options = backup.push.mock.calls[0]![0];
    expect(options).toMatchObject({ lockWaitMs: AUTO_BACKUP_LOCK_WAIT_MS });
    expect(options.allowMissing).toBeUndefined();
    expect(options.message).toContain('alpha');
    expect(AUTO_BACKUP_LOCK_WAIT_MS).toBe(600_000);
  });

  test('passes the caller\'s signal to push, so a shutting-down API can abort it (#734 review)', async () => {
    const backup = fakeBackup({});
    const shutdown = new AbortController();

    await autoBackupOnStop(backup, 'alpha', { signal: shutdown.signal });

    expect(backup.push.mock.calls[0]![0].signal).toBe(shutdown.signal);
  });

  test.each([
    ['BACKUP_AUTO_ON_STOP is not true', { autoOnStop: false }],
    ['the token or repository is missing', { configured: false }],
  ])('skips when %s', async (_why, status) => {
    const backup = fakeBackup(status);

    expect(await autoBackupOnStop(backup, 'alpha')).toEqual({ status: 'skipped' });
    expect(backup.push).not.toHaveBeenCalled();
  });

  test('reports a failed push instead of throwing', async () => {
    const backup = fakeBackup({}, async () => ({ ok: false, error: { code: 'locked', message: 'held' } }));

    expect(await autoBackupOnStop(backup, 'alpha')).toEqual({
      status: 'failed',
      error: { code: 'locked', message: 'held' },
    });
  });

  test('reports an unreadable configuration as a failure, not as "off"', async () => {
    const backup = fakeBackup(new Error('Cannot read .env'));

    expect(await autoBackupOnStop(backup, 'alpha')).toMatchObject({
      status: 'failed',
      error: { message: 'Cannot read .env' },
    });
    expect(backup.push).not.toHaveBeenCalled();
  });

  test('never rejects, even if the port does', async () => {
    const backup = fakeBackup({}, async () => {
      throw new Error('boom');
    });

    expect(await autoBackupOnStop(backup, 'alpha')).toMatchObject({
      status: 'failed',
      error: { code: 'io_failed', message: 'boom' },
    });
  });

  test('PM2 gives mcctl-api longer than the close wait (templates/ecosystem.config.js pins 130000)', () => {
    expect(AUTO_BACKUP_CLOSE_WAIT_MS).toBe(120_000);
    expect(API_PM2_KILL_TIMEOUT_MS).toBe(130_000);
  });
});
