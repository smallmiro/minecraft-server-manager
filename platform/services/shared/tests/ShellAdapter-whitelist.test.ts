import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/docker/index.js', () => ({
  execScript: vi.fn(async () => ({ code: 0, stdout: '', stderr: '' })),
  execScriptInteractive: vi.fn(),
}));

import { execScript } from '../src/docker/index.js';
import { ShellAdapter } from '../src/infrastructure/adapters/ShellAdapter.js';
import { ServerName, ServerType, McVersion, WorldOptions } from '../src/domain/index.js';
import type { CreateServerOptions } from '../src/application/ports/outbound/IShellPort.js';

/**
 * ShellAdapter.createServer whitelist arguments (#679)
 * Whitelist is off by default in create-server.sh, so flags are passed only
 * to enable it (or to disable it explicitly).
 */
describe('ShellAdapter.createServer - whitelist args', () => {
  const base: CreateServerOptions = {
    type: ServerType.create('PAPER'),
    version: McVersion.create('1.21.1'),
    worldOptions: WorldOptions.newWorld(),
    autoStart: false,
  };

  async function argsFor(extra: Partial<CreateServerOptions>): Promise<string[]> {
    await new ShellAdapter().createServer(ServerName.create('wl'), { ...base, ...extra });
    const calls = vi.mocked(execScript).mock.calls;
    return calls[calls.length - 1]![1] as string[];
  }

  beforeEach(() => vi.mocked(execScript).mockClear());

  test('passes no whitelist flag when unspecified', async () => {
    const args = await argsFor({});
    expect(args.some((a) => a.includes('whitelist'))).toBe(false);
  });

  test('passes --enable-whitelist when enabled without players', async () => {
    const args = await argsFor({ enableWhitelist: true });
    expect(args).toContain('--enable-whitelist');
    expect(args).not.toContain('--whitelist');
  });

  test('passes --whitelist with players when enabled with players', async () => {
    const args = await argsFor({ enableWhitelist: true, whitelistPlayers: ['a', 'b'] });
    expect(args).toEqual(expect.arrayContaining(['--whitelist', 'a,b']));
    expect(args).not.toContain('--no-whitelist');
  });

  test('passes only --no-whitelist when disabled, even with players', async () => {
    const args = await argsFor({ enableWhitelist: false, whitelistPlayers: ['a'] });
    expect(args).toContain('--no-whitelist');
    expect(args).not.toContain('--whitelist');
    expect(args).not.toContain('--enable-whitelist');
  });
});
