import { describe, it, expect } from 'vitest';
import { ShellAdapter } from '../src/infrastructure/adapters/ShellAdapter.js';

/** backup.sh is removed (#732); the deprecated methods fail with a pointer to the port. */
describe('ShellAdapter deprecated backup methods (#732)', () => {
  const shell = new ShellAdapter();

  it.each([
    ['backupPush', () => shell.backupPush('m')],
    ['backupStatus', () => shell.backupStatus()],
    ['backupHistory', () => shell.backupHistory(true)],
    ['backupRestore', () => shell.backupRestore('abc1234')],
  ])('%s returns a clear failure', async (_name, call) => {
    const result = await call();
    expect(result.success).toBe(false);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('IWorldBackupPort');
  });
});
