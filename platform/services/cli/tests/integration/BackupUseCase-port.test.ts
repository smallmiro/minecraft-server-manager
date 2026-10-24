/**
 * BackupUseCase on IWorldBackupPort (#732): status (#13), history (#12),
 * push (#8), restore and the init connection test (#10).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  BackupUseCase,
  type IWorldBackupPort,
  type WorldBackupResult,
  type WorldBackupPushOptions,
  type LockOptions,
} from '@minecraft-docker/shared';
import { MockPromptAdapter } from '../mocks/index.js';

const HASH = 'abc1234def5678901234567890abcdef12345678';

class FakePort implements IWorldBackupPort {
  calls: Array<[string, unknown[]]> = [];
  statusResult: Awaited<ReturnType<IWorldBackupPort['status']>> = {
    ok: true,
    value: {
      configured: true,
      repository: 'user/worlds',
      branch: 'main',
      autoOnStop: true,
      lastBackup: { commit: HASH, date: new Date('2026-10-20T10:00:00Z') },
    },
  };
  pushResult: Awaited<ReturnType<IWorldBackupPort['push']>> = {
    ok: true,
    value: { changed: true, commit: HASH, flushed: [], skipped: [], warnings: [] },
  };
  restoreResult: Awaited<ReturnType<IWorldBackupPort['restore']>> = {
    ok: true,
    value: { commit: HASH, previousDir: '/root/backups/restore-previous/x', skipped: [] },
  };
  connectionResult: WorldBackupResult<void> = { ok: true, value: undefined };

  async status() {
    this.calls.push(['status', []]);
    return this.statusResult;
  }
  historyResult: Awaited<ReturnType<IWorldBackupPort['history']>> = {
    ok: true,
    value: [
      { hash: HASH, date: new Date('2026-10-20T10:00:00Z'), author: 'Minecraft Backup', message: 'a | "b"' },
      { hash: 'f'.repeat(40), date: new Date('2026-10-19T10:00:00Z'), author: 'Minecraft Backup', message: 'older' },
    ],
  };
  async history(limit?: number) {
    this.calls.push(['history', [limit]]);
    return this.historyResult;
  }
  async push(options?: WorldBackupPushOptions) {
    this.calls.push(['push', [options]]);
    return this.pushResult;
  }
  async restore(commit: string, options?: LockOptions) {
    this.calls.push(['restore', [commit, options]]);
    return this.restoreResult;
  }
  async prune() {
    return { ok: true as const, value: { removed: 0, warnings: [] } };
  }
  async testConnection(credentials: { token: string; repository: string }) {
    this.calls.push(['testConnection', [credentials]]);
    return this.connectionResult;
  }
}

describe('BackupUseCase with IWorldBackupPort (#732)', () => {
  let prompt: MockPromptAdapter;
  let port: FakePort;
  let useCase: BackupUseCase;

  beforeEach(() => {
    prompt = new MockPromptAdapter({ confirm: true, selectIndex: 0 });
    port = new FakePort();
    useCase = new BackupUseCase(prompt, port);
  });

  it('status maps the real configuration and last backup (#13)', async () => {
    expect(await useCase.status()).toEqual({
      configured: true,
      repository: 'user/worlds',
      branch: 'main',
      lastBackup: new Date('2026-10-20T10:00:00Z'),
      autoBackupEnabled: true,
    });
  });

  it('status is not configured when the port says so or fails', async () => {
    port.statusResult = { ok: true, value: { configured: false, branch: 'main', autoOnStop: false } };
    expect((await useCase.status()).configured).toBe(false);
    port.statusResult = { ok: false, error: { code: 'io_failed', message: 'EACCES' } };
    expect((await useCase.status()).configured).toBe(false);
  });

  it('history returns real entries (#12)', async () => {
    const history = await useCase.history();
    expect(history.map((h) => [h.commitHash, h.message, h.author])).toEqual([
      [HASH, 'a | "b"', 'Minecraft Backup'],
      ['f'.repeat(40), 'older', 'Minecraft Backup'],
    ]);
    expect(history[0]!.date).toEqual(new Date('2026-10-20T10:00:00Z'));
  });

  it('pushWithMessage passes the options and returns the commit', async () => {
    const result = await useCase.pushWithMessage('before upgrade', { allowMissing: true, lockWaitMs: 1000 });
    expect(result).toMatchObject({ success: true, commitHash: HASH, message: 'before upgrade' });
    expect(port.calls).toContainEqual(['push', [{ message: 'before upgrade', allowMissing: true, lockWaitMs: 1000 }]]);
  });

  it('"no changes" is success (#8)', async () => {
    port.pushResult = { ok: true, value: { changed: false, commit: HASH, flushed: [], skipped: [], warnings: [] } };
    const result = await useCase.pushWithMessage('m');
    expect(result.success).toBe(true);
    expect(result.noChanges).toBe(true);
  });

  it('push failures carry the port error code', async () => {
    port.pushResult = {
      ok: false,
      error: { code: 'missing_worlds', message: 'Worlds in the last backup are missing', paths: ['worlds/b'] },
    };
    const result = await useCase.pushWithMessage('m');
    expect(result).toMatchObject({ success: false, errorCode: 'missing_worlds' });
    expect(result.error).toContain('missing');
  });

  it('interactive push stops when not configured', async () => {
    port.statusResult = { ok: true, value: { configured: false, branch: 'main', autoOnStop: false } };
    const result = await useCase.push();
    expect(result.success).toBe(false);
    expect(port.calls.some(([m]) => m === 'push')).toBe(false);
  });

  it('restoreFromCommit restores through the port and maps errors', async () => {
    expect(await useCase.restoreFromCommit('abc1234')).toMatchObject({ success: true, commitHash: HASH });
    port.restoreResult = { ok: false, error: { code: 'servers_running', message: 'Stop all servers', servers: ['a'] } };
    expect(await useCase.restoreFromCommit('abc1234')).toMatchObject({
      success: false,
      commitHash: 'abc1234',
      errorCode: 'servers_running',
    });
  });

  it('interactive restore lists the real history', async () => {
    const result = await useCase.restore();
    expect(result).toMatchObject({ success: true, commitHash: HASH });
  });

  it('init tests the connection through the port, not a <scripts>/git lookup (#10)', async () => {
    port.statusResult = { ok: true, value: { configured: false, branch: 'main', autoOnStop: false } };
    prompt = new MockPromptAdapter({ confirm: true, selectIndex: 0, password: 'ghp_token' });
    prompt.textValues = ['user/worlds'];
    useCase = new BackupUseCase(prompt, port);
    let saved: Record<string, string | boolean> | undefined;
    useCase.setConfigSaveCallback((c) => {
      saved = c;
    });
    const result = await useCase.init();
    expect(result.success).toBe(true);
    expect(port.calls).toContainEqual(['testConnection', [{ token: 'ghp_token', repository: 'user/worlds' }]]);
    expect(saved?.BACKUP_GITHUB_REPO).toBe('user/worlds');
  });

  it('init reports a failed connection with the port message', async () => {
    port.statusResult = { ok: true, value: { configured: false, branch: 'main', autoOnStop: false } };
    port.connectionResult = { ok: false, error: { code: 'auth_failed', message: 'Authentication failed' } };
    prompt = new MockPromptAdapter({ confirm: true, selectIndex: 0, password: 'ghp_token' });
    prompt.textValues = ['user/worlds'];
    useCase = new BackupUseCase(prompt, port);
    const result = await useCase.init();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication failed');
  });
});

/** The prompt flows, independent of the backend (#736). */
describe('BackupUseCase prompt flows', () => {
  const NOT_CONFIGURED = { ok: true as const, value: { configured: false, branch: 'main', autoOnStop: false } };
  let prompt: MockPromptAdapter;
  let port: FakePort;
  let useCase: BackupUseCase;
  const called = (method: string) => port.calls.some(([m]) => m === method);

  beforeEach(() => {
    prompt = new MockPromptAdapter({ confirm: true, selectIndex: 0 });
    port = new FakePort();
    useCase = new BackupUseCase(prompt, port);
  });

  describe('push', () => {
    it('pushes with the message the user typed', async () => {
      prompt.textValues = ['My backup message'];
      const result = await useCase.push();
      expect(result).toMatchObject({ success: true, message: 'My backup message' });
      expect(port.calls).toContainEqual(['push', [{ message: 'My backup message' }]]);
      expect(prompt.introMessage).toBe('Backup Worlds to GitHub');
    });

    it('returns "not configured" without pushing', async () => {
      port.statusResult = NOT_CONFIGURED;
      const result = await useCase.push();
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('handles cancellation', async () => {
      prompt.setCancelled(true);
      expect(await useCase.push()).toMatchObject({ success: false, error: 'Cancelled' });
      expect(called('push')).toBe(false);
    });
  });

  describe('restore', () => {
    it('shows the intro', async () => {
      await useCase.restore();
      expect(prompt.introMessage).toBe('Restore from Backup');
    });

    it('fails when there is no history', async () => {
      port.historyResult = { ok: true, value: [] };
      const result = await useCase.restore();
      expect(result.success).toBe(false);
      expect(result.error).toContain('No backup history');
    });

    it('does not restore when the user declines', async () => {
      prompt = new MockPromptAdapter({ confirm: false });
      useCase = new BackupUseCase(prompt, port);
      expect((await useCase.restore()).success).toBe(false);
      expect(called('restore')).toBe(false);
    });

    it('handles cancellation', async () => {
      prompt.setCancelled(true);
      expect(await useCase.restore()).toMatchObject({ success: false, error: 'Cancelled' });
    });
  });

  describe('init', () => {
    let saved: Record<string, string | boolean> | null;

    function initWith(options: ConstructorParameters<typeof MockPromptAdapter>[0], texts: string[]) {
      prompt = new MockPromptAdapter(options);
      prompt.textValues = texts;
      useCase = new BackupUseCase(prompt, port);
      useCase.setConfigSaveCallback((config) => {
        saved = config;
      });
    }

    beforeEach(() => {
      saved = null;
      port.statusResult = NOT_CONFIGURED;
      initWith({ password: 'ghp_test_token_12345', confirm: true, selectIndex: 0 }, ['user/minecraft-backup']);
    });

    it('saves the answers', async () => {
      const result = await useCase.init();
      expect(result).toMatchObject({ success: true, repository: 'user/minecraft-backup', branch: 'main', autoBackupEnabled: true });
      expect(prompt.introMessage).toBe('GitHub Backup Setup');
      expect(saved).toEqual({
        BACKUP_GITHUB_TOKEN: 'ghp_test_token_12345',
        BACKUP_GITHUB_REPO: 'user/minecraft-backup',
        BACKUP_GITHUB_BRANCH: 'main',
        BACKUP_AUTO_ON_STOP: true,
      });
    });

    it('overwrites an existing configuration after confirmation', async () => {
      port.statusResult = new FakePort().statusResult;
      initWith({ password: 'ghp_new_token', confirm: true, selectIndex: 0 }, ['new/repo']);
      expect(await useCase.init()).toMatchObject({ success: true, repository: 'new/repo' });
    });

    it('keeps an existing configuration when the user declines', async () => {
      port.statusResult = new FakePort().statusResult;
      initWith({ confirm: false }, []);
      const result = await useCase.init();
      expect(result.success).toBe(false);
      expect(result.error).toContain('existing configuration preserved');
      expect(called('testConnection')).toBe(false);
    });

    it('does not ask to overwrite with force', async () => {
      port.statusResult = new FakePort().statusResult;
      initWith({ password: 'ghp_force_token', confirm: true, selectIndex: 0 }, ['force/repo']);
      const confirm = prompt.confirm.bind(prompt);
      const asked: string[] = [];
      prompt.confirm = async (options) => {
        asked.push(options.message);
        return confirm(options);
      };
      expect(await useCase.init(true)).toMatchObject({ success: true, repository: 'force/repo' });
      expect(asked.some((m) => m.includes('overwrite'))).toBe(false);
    });

    it('handles cancellation at the token prompt', async () => {
      prompt.setCancelled(true);
      expect(await useCase.init()).toMatchObject({ success: false, error: 'Cancelled' });
    });

    it('takes a custom branch', async () => {
      initWith({ password: 'ghp_token', confirm: true, selectIndex: 2 }, ['user/repo', 'develop']);
      expect(await useCase.init()).toMatchObject({ success: true, branch: 'develop' });
    });

    it('disables auto backup when the user declines it', async () => {
      const confirm = prompt.confirm.bind(prompt);
      prompt.confirm = async (options) => (options.message.includes('auto backup') ? false : confirm(options));
      expect(await useCase.init()).toMatchObject({ success: true, autoBackupEnabled: false });
    });
  });
});
