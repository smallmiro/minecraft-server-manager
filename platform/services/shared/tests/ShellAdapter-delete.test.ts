import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/docker/index.js', () => ({
  execScript: vi.fn(async () => ({ code: 0, stdout: '', stderr: '' })),
  execScriptInteractive: vi.fn(),
}));

import { execScript } from '../src/docker/index.js';
import { ShellAdapter } from '../src/infrastructure/adapters/ShellAdapter.js';
import { ServerName } from '../src/domain/index.js';

/** ShellAdapter.deleteServer arguments (#652): worlds are kept unless asked. */
describe('ShellAdapter.deleteServer - args', () => {
  const lastArgs = () => vi.mocked(execScript).mock.calls.at(-1)![1] as string[];

  beforeEach(() => vi.mocked(execScript).mockClear());

  test('keeps the world by default', async () => {
    await new ShellAdapter().deleteServer(ServerName.create('alpha'), true);
    expect(lastArgs()).toEqual(['alpha', '--force']);
  });

  test('passes --delete-world only when asked', async () => {
    await new ShellAdapter().deleteServer(ServerName.create('alpha'), true, true);
    expect(lastArgs()).toEqual(['alpha', '--force', '--delete-world']);
  });
});
