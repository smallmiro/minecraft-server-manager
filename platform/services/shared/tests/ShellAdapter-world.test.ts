import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/docker/index.js', () => ({
  execScript: vi.fn(async () => ({ code: 0, stdout: '', stderr: '' })),
  execScriptInteractive: vi.fn(),
}));

import { execScript } from '../src/docker/index.js';
import { ShellAdapter } from '../src/infrastructure/adapters/ShellAdapter.js';

/**
 * lock.sh was removed (#670). The deprecated v2 world methods keep their
 * signatures but fail without running any script.
 */
describe('ShellAdapter deprecated world methods (#670)', () => {
  beforeEach(() => vi.mocked(execScript).mockClear());

  test.each([
    ['worldList', (s: ShellAdapter) => s.worldList(true)],
    ['worldAssign', (s: ShellAdapter) => s.worldAssign('w', 'alpha', true)],
    ['worldRelease', (s: ShellAdapter) => s.worldRelease('w')],
  ])('%s fails with a removal notice and runs nothing', async (_name, call) => {
    const result = await call(new ShellAdapter());

    expect(result.success).toBe(false);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toMatch(/lock\.sh was removed.*IWorldAssignmentPort/);
    expect(execScript).not.toHaveBeenCalled();
  });
});
