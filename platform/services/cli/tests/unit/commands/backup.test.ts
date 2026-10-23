/**
 * mcctl backup (#732): --auto is non-interactive, --allow-missing, restore
 * confirmation, and error-code hints.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const useCase = {
  setConfigSaveCallback: vi.fn(),
  init: vi.fn(),
  push: vi.fn(),
  pushWithMessage: vi.fn(),
  status: vi.fn(),
  history: vi.fn(),
  restore: vi.fn(),
  restoreFromCommit: vi.fn(),
};
const promptPort = { confirm: vi.fn(), isCancel: vi.fn().mockReturnValue(false) };
const logged: string[] = [];

vi.mock('@minecraft-docker/shared', async () => {
  const actual = await vi.importActual<typeof import('@minecraft-docker/shared')>('@minecraft-docker/shared');
  const push = (s: string) => {
    logged.push(s);
  };
  return {
    ...actual,
    Paths: vi.fn().mockImplementation(() => ({ isInitialized: () => true, root: '/tmp/test-root' })),
    log: { error: push, warn: push, info: push },
  };
});

vi.mock('../../../src/infrastructure/index.js', () => ({
  getContainer: () => ({ backupUseCase: useCase, promptPort }),
}));

import { backupCommand } from '../../../src/commands/backup.js';

describe('mcctl backup (#732)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logged.length = 0;
    vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
      logged.push(a.join(' '));
    });
    useCase.pushWithMessage.mockResolvedValue({ success: true, commitHash: 'abc1234def', message: '' });
    useCase.restoreFromCommit.mockResolvedValue({ success: true, commitHash: 'abc1234def' });
  });

  it('push --auto never prompts and waits for the lock', async () => {
    expect(await backupCommand({ subCommand: 'push', auto: true })).toBe(0);
    expect(useCase.push).not.toHaveBeenCalled();
    expect(useCase.pushWithMessage).toHaveBeenCalledWith('', { allowMissing: false, lockWaitMs: 600_000 });
  });

  it('push --message --allow-missing passes the consent', async () => {
    expect(await backupCommand({ subCommand: 'push', message: 'm', allowMissing: true })).toBe(0);
    expect(useCase.pushWithMessage).toHaveBeenCalledWith('m', { allowMissing: true, lockWaitMs: 0 });
  });

  it('a missing-world failure tells how to consent', async () => {
    useCase.pushWithMessage.mockResolvedValue({ success: false, error: 'missing', errorCode: 'missing_worlds' });
    expect(await backupCommand({ subCommand: 'push', auto: true })).toBe(1);
    expect(logged.join('\n')).toContain('mcctl backup push --allow-missing');
  });

  it('a lock failure explains how to clear a stale lock', async () => {
    useCase.pushWithMessage.mockResolvedValue({ success: false, error: 'busy', errorCode: 'locked' });
    expect(await backupCommand({ subCommand: 'push', message: 'm' })).toBe(1);
    expect(logged.join('\n')).toContain('backups/.backup.lock');
  });

  it('restore <commit> asks for confirmation without --force', async () => {
    promptPort.confirm.mockResolvedValue(false);
    expect(await backupCommand({ subCommand: 'restore', commitHash: 'abc1234' })).toBe(0);
    expect(promptPort.confirm).toHaveBeenCalled();
    expect(useCase.restoreFromCommit).not.toHaveBeenCalled();

    promptPort.confirm.mockResolvedValue(true);
    expect(await backupCommand({ subCommand: 'restore', commitHash: 'abc1234' })).toBe(0);
    expect(useCase.restoreFromCommit).toHaveBeenCalledWith('abc1234');
  });

  it('restore <commit> --force does not prompt', async () => {
    expect(await backupCommand({ subCommand: 'restore', commitHash: 'abc1234', force: true })).toBe(0);
    expect(promptPort.confirm).not.toHaveBeenCalled();
    expect(useCase.restoreFromCommit).toHaveBeenCalledWith('abc1234');
  });

  it('a restore refused for running servers says to stop them', async () => {
    useCase.restoreFromCommit.mockResolvedValue({ success: false, commitHash: 'abc1234', error: 'running', errorCode: 'servers_running' });
    expect(await backupCommand({ subCommand: 'restore', commitHash: 'abc1234', force: true })).toBe(1);
    expect(logged.join('\n')).toMatch(/Stop/);
  });
});
