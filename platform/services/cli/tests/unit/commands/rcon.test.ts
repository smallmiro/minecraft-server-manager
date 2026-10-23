/**
 * Interactive RCON over TCP, shared by `mcctl rcon <server>` and
 * `mcctl console <server>` (#734: console no longer runs mcctl.sh's
 * `docker exec -i rcon-cli`). The endpoint comes from IServerConsolePort.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PassThrough } from 'node:stream';
import {
  ServerName,
  log,
  type ContainerStatus,
  type ConsoleEndpoint,
  type IContainerRuntimePort,
  type IServerConsolePort,
} from '@minecraft-docker/shared';
import { rconCommand } from '../../../src/commands/rcon.js';

vi.mock('@minecraft-docker/shared', async () => {
  const actual = await vi.importActual<typeof import('@minecraft-docker/shared')>('@minecraft-docker/shared');
  return {
    ...actual,
    Paths: vi.fn().mockImplementation(() => ({ isInitialized: () => true })),
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  };
});

const ALPHA = ServerName.fromExisting('alpha');
const ENDPOINT: ConsoleEndpoint = { host: '172.18.0.5', port: 25575, password: 'secret' };

function deps(status: ContainerStatus, endpoint: ConsoleEndpoint | null = ENDPOINT) {
  const session = { send: vi.fn(async (cmd: string) => `ran ${cmd}`), end: vi.fn(async () => undefined) };
  const input = new PassThrough();
  const output = new PassThrough();
  let printed = '';
  output.on('data', (d: Buffer) => (printed += d.toString()));
  return {
    session,
    input,
    printed: () => printed,
    options: {
      serverName: 'alpha',
      runtime: { getStatus: vi.fn(() => status) } as unknown as IContainerRuntimePort,
      console: { getEndpoint: vi.fn(async () => endpoint) } as unknown as IServerConsolePort,
      connect: vi.fn(async () => session),
      input,
      output,
    },
  };
}

beforeEach(() => vi.mocked(log.error).mockClear());

describe('rconCommand (mcctl rcon / mcctl console)', () => {
  it('opens a TCP RCON session at the endpoint the console port reports', async () => {
    const d = deps('running');

    const done = rconCommand(d.options);
    await vi.waitFor(() => expect(d.options.connect).toHaveBeenCalled());
    d.input.write('list\n');
    await vi.waitFor(() => expect(d.session.send).toHaveBeenCalledWith('list'));
    d.input.write('exit\n');

    expect(await done).toBe(0);
    expect(d.options.console.getEndpoint).toHaveBeenCalledWith(ALPHA);
    expect(d.options.connect).toHaveBeenCalledWith(ENDPOINT);
    expect(d.session.end).toHaveBeenCalled();
    expect(d.printed()).toContain('ran list');
  });

  it('ends the session when the input closes (Ctrl+D)', async () => {
    const d = deps('running');
    const done = rconCommand(d.options);
    await vi.waitFor(() => expect(d.options.connect).toHaveBeenCalled());
    d.input.end();
    expect(await done).toBe(0);
    expect(d.session.end).toHaveBeenCalled();
  });

  it.each<ContainerStatus>(['exited', 'not_found'])('refuses a %s server without connecting', async (status) => {
    const d = deps(status);

    expect(await rconCommand(d.options)).toBe(1);

    expect(d.options.connect).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('not running'));
  });

  it('fails when the endpoint is unknown or has no RCON password', async () => {
    const unknown = deps('running', null);
    expect(await rconCommand(unknown.options)).toBe(1);
    expect(unknown.options.connect).not.toHaveBeenCalled();

    const noPassword = deps('running', { ...ENDPOINT, password: '' });
    expect(await rconCommand(noPassword.options)).toBe(1);
    expect(noPassword.options.connect).not.toHaveBeenCalled();
  });

  it('fails when the connection is refused', async () => {
    const d = deps('running');
    d.options.connect.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    expect(await rconCommand(d.options)).toBe(1);
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
  });

  it('names the command it was called as in the usage message', async () => {
    const d = deps('running');
    expect(await rconCommand({ ...d.options, serverName: undefined, command: 'console' })).toBe(1);
    expect(log.info).toHaveBeenCalledWith('Usage: mcctl console <server>');
  });
});
