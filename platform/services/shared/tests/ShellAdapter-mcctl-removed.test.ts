import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/docker/index.js', () => ({
  execScript: vi.fn(async () => ({ code: 0, stdout: '', stderr: '' })),
  execScriptInteractive: vi.fn(async () => 0),
}));

import { execScript } from '../src/docker/index.js';
import { ShellAdapter } from '../src/infrastructure/adapters/ShellAdapter.js';
import { ServerName } from '../src/domain/value-objects/ServerName.js';

/**
 * mcctl.sh was removed (#734). The deprecated v2 methods that ran it keep
 * their signatures but fail with a pointer to the replacement.
 */
describe('ShellAdapter methods that ran mcctl.sh (#734)', () => {
  beforeEach(() => vi.mocked(execScript).mockClear());
  const alpha = ServerName.fromExisting('alpha');

  test.each([
    ['startServer', (s: ShellAdapter) => s.startServer(alpha), /IContainerRuntimePort\.start/],
    ['stopServer', (s: ShellAdapter) => s.stopServer('alpha'), /IContainerRuntimePort\.stop/],
    ['serverStatus', (s: ShellAdapter) => s.serverStatus('alpha'), /IContainerRuntimePort\.getStatus/],
    ['setServerConfig', (s: ShellAdapter) => s.setServerConfig('alpha', 'SEED', '1'), /env-file/],
    ['logs', (s: ShellAdapter) => s.logs(alpha), /mcctl logs/],
    ['console', (s: ShellAdapter) => s.console(alpha), /mcctl console/],
    ['status', (s: ShellAdapter) => s.status(true), /mcctl status/],
  ])('%s fails with a removal notice and runs nothing', async (_name, call, replacement) => {
    const result = await call(new ShellAdapter());

    expect(result.success).toBe(false);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/mcctl\.sh was removed \(#734\)/);
    expect(result.stderr).toMatch(replacement);
    expect(execScript).not.toHaveBeenCalled();
  });
});
