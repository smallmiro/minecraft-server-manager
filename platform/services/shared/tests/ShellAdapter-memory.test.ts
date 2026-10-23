import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/docker/index.js', () => ({
  execScript: vi.fn(async () => ({ code: 0, stdout: '', stderr: '' })),
  execScriptInteractive: vi.fn(),
}));

import { execScript } from '../src/docker/index.js';
import { ShellAdapter } from '../src/infrastructure/adapters/ShellAdapter.js';
import { ServerName, ServerType, McVersion, WorldOptions, Memory } from '../src/domain/index.js';
import type { CreateServerOptions } from '../src/application/ports/outbound/IShellPort.js';

/**
 * ShellAdapter.createServer memory argument (#737)
 */
describe('ShellAdapter.createServer - memory args', () => {
  const base: CreateServerOptions = {
    type: ServerType.create('PAPER'),
    version: McVersion.create('1.21.1'),
    worldOptions: WorldOptions.newWorld(),
    autoStart: false,
  };

  async function argsFor(extra: Partial<CreateServerOptions>): Promise<string[]> {
    await new ShellAdapter().createServer(ServerName.create('mem'), { ...base, ...extra });
    const calls = vi.mocked(execScript).mock.calls;
    return calls[calls.length - 1]![1] as string[];
  }

  beforeEach(() => vi.mocked(execScript).mockClear());

  test('passes -m with the value when memory is set', async () => {
    const args = await argsFor({ memory: Memory.create('6G') });
    const i = args.indexOf('-m');
    expect(i).toBeGreaterThan(-1);
    expect(args[i + 1]).toBe('6G');
  });

  test('passes no memory flag when memory is unset', async () => {
    const args = await argsFor({});
    expect(args).not.toContain('-m');
    expect(args).not.toContain('--memory');
  });
});
