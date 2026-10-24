/**
 * delete-server.sh was removed in #735. The v2 signature stays (#736): the
 * shell path fails with a clear message instead of ENOENT, and runs nothing.
 */
import { describe, test, expect, vi } from 'vitest';

vi.mock('../src/docker/index.js', () => ({
  execScript: vi.fn(async () => ({ code: 0, stdout: '', stderr: '' })),
  execScriptInteractive: vi.fn(),
}));

import { execScript } from '../src/docker/index.js';
import { ShellAdapter } from '../src/infrastructure/adapters/ShellAdapter.js';
import { ServerName } from '../src/domain/index.js';

describe('ShellAdapter.deleteServer (#735)', () => {
  test('rejects with the removal message and runs no script', async () => {
    await expect(new ShellAdapter().deleteServer(ServerName.create('alpha'), true, true)).rejects.toThrow(
      /delete-server\.sh was removed in #735; use DeleteServerUseCase with ServerSpec deprovision/
    );
    expect(execScript).not.toHaveBeenCalled();
  });
});
