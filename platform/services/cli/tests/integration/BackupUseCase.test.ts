import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { BackupUseCase } from '../../src/application/use-cases/BackupUseCase.js';
import { MockPromptAdapter, MockShellAdapter } from '../mocks/index.js';

describe('BackupUseCase Integration', () => {
  let promptAdapter: MockPromptAdapter;
  let shellAdapter: MockShellAdapter;
  let useCase: BackupUseCase;

  beforeEach(() => {
    promptAdapter = new MockPromptAdapter({
      confirm: true,
      selectIndex: 0,
    });
    shellAdapter = new MockShellAdapter({
      backupStatusResult: {
        success: true,
        stdout: `Repository: user/minecraft-backup
Branch: main
Last backup: 2025-01-17T12:00:00Z
Auto backup: enabled`,
      },
      backupPushResult: {
        success: true,
        stdout: 'Backup complete. commit: abc1234def567',
      },
      backupHistoryResult: {
        success: true,
        stdout: JSON.stringify([
          {
            hash: 'abc1234def567890',
            message: 'Manual backup',
            date: '2025-01-17T12:00:00Z',
            author: 'user',
          },
          {
            hash: 'def5678abc123456',
            message: 'Auto backup',
            date: '2025-01-16T18:00:00Z',
            author: 'system',
          },
        ]),
      },
      backupRestoreResult: {
        success: true,
        stdout: 'Restore complete',
      },
    });
    useCase = new BackupUseCase(promptAdapter, shellAdapter);
  });

  describe('status', () => {
    it('should return configured status when backup is set up', async () => {
      const result = await useCase.status();

      assert.strictEqual(result.configured, true);
      assert.strictEqual(result.repository, 'user/minecraft-backup');
      assert.strictEqual(result.branch, 'main');
      assert.strictEqual(result.autoBackupEnabled, true);
    });

    it('should return not configured when backup fails', async () => {
      shellAdapter = new MockShellAdapter({
        backupStatusResult: { success: false },
      });
      useCase = new BackupUseCase(promptAdapter, shellAdapter);

      const result = await useCase.status();

      assert.strictEqual(result.configured, false);
    });
  });

  describe('push (interactive)', () => {
    it('should push backup with user message', async () => {
      promptAdapter = new MockPromptAdapter({
        confirm: true,
      });
      promptAdapter.textValues = ['My backup message'];
      useCase = new BackupUseCase(promptAdapter, shellAdapter);

      const result = await useCase.push();

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, 'My backup message');
      assert.ok(shellAdapter.wasCommandCalled('backupPush'));
    });

    it('should show intro message', async () => {
      promptAdapter.textValues = ['Test'];
      await useCase.push();

      assert.strictEqual(promptAdapter.introMessage, 'Backup Worlds to GitHub');
    });

    it('should return error when backup not configured', async () => {
      shellAdapter = new MockShellAdapter({
        backupStatusResult: { success: false },
      });
      useCase = new BackupUseCase(promptAdapter, shellAdapter);

      const result = await useCase.push();

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('not configured'));
    });

    it('should handle cancellation', async () => {
      promptAdapter.setCancelled(true);

      const result = await useCase.push();

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Cancelled');
    });
  });

  describe('pushWithMessage', () => {
    it('should push backup with specified message', async () => {
      const result = await useCase.pushWithMessage('Server upgrade backup');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, 'Server upgrade backup');
      assert.strictEqual(result.commitHash, 'abc1234def567');
    });

    it('should return error when shell fails', async () => {
      shellAdapter = new MockShellAdapter({
        backupPushResult: {
          success: false,
          stderr: 'GitHub push failed',
        },
      });
      useCase = new BackupUseCase(promptAdapter, shellAdapter);

      const result = await useCase.pushWithMessage('Test backup');

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('push failed'));
    });
  });

  describe('history', () => {
    it('should return backup history entries', async () => {
      const history = await useCase.history();

      assert.strictEqual(history.length, 2);
      assert.strictEqual(history[0]?.commitHash, 'abc1234def567890');
      assert.strictEqual(history[0]?.message, 'Manual backup');
      assert.strictEqual(history[1]?.commitHash, 'def5678abc123456');
    });

    it('should return empty array when no history', async () => {
      shellAdapter = new MockShellAdapter({
        backupHistoryResult: { success: false },
      });
      useCase = new BackupUseCase(promptAdapter, shellAdapter);

      const history = await useCase.history();

      assert.deepStrictEqual(history, []);
    });

    it('should handle malformed JSON', async () => {
      shellAdapter = new MockShellAdapter({
        backupHistoryResult: {
          success: true,
          stdout: 'invalid json',
        },
      });
      useCase = new BackupUseCase(promptAdapter, shellAdapter);

      const history = await useCase.history();

      assert.deepStrictEqual(history, []);
    });
  });

  describe('restore (interactive)', () => {
    it('should restore from selected backup', async () => {
      const result = await useCase.restore();

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.commitHash, 'abc1234def567890');
    });

    it('should show intro message', async () => {
      await useCase.restore();

      assert.strictEqual(promptAdapter.introMessage, 'Restore from Backup');
    });

    it('should return error when no history', async () => {
      shellAdapter = new MockShellAdapter({
        backupHistoryResult: { success: false },
      });
      useCase = new BackupUseCase(promptAdapter, shellAdapter);

      const result = await useCase.restore();

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('No backup history'));
    });

    it('should return error when user declines', async () => {
      promptAdapter = new MockPromptAdapter({ confirm: false });
      shellAdapter = new MockShellAdapter({
        backupHistoryResult: {
          success: true,
          stdout: JSON.stringify([
            {
              hash: 'abc1234',
              message: 'Test',
              date: '2025-01-17T12:00:00Z',
              author: 'user',
            },
          ]),
        },
      });
      useCase = new BackupUseCase(promptAdapter, shellAdapter);

      const result = await useCase.restore();

      assert.strictEqual(result.success, false);
      assert.ok(!shellAdapter.wasCommandCalled('backupRestore'));
    });

    it('should handle cancellation', async () => {
      promptAdapter.setCancelled(true);

      const result = await useCase.restore();

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Cancelled');
    });
  });

  describe('restoreFromCommit', () => {
    it('should restore from specific commit', async () => {
      const result = await useCase.restoreFromCommit('abc1234');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.commitHash, 'abc1234');
      assert.ok(shellAdapter.wasCommandCalled('backupRestore'));
    });

    it('should return error when restore fails', async () => {
      shellAdapter = new MockShellAdapter({
        backupRestoreResult: {
          success: false,
          stderr: 'Restore failed: invalid commit',
        },
      });
      useCase = new BackupUseCase(promptAdapter, shellAdapter);

      const result = await useCase.restoreFromCommit('invalid');

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('invalid commit'));
    });
  });
});
