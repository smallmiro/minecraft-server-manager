/**
 * The CLI RCON helpers (op, whitelist, kick, ban, msg, player, migrate) go
 * through the runtime and console ports of the DI container (#668, ADR-0001
 * rows 9-10) instead of running `docker inspect` / `docker exec` themselves.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServerName, type ContainerStatus } from '@minecraft-docker/shared';

const runtime = { getStatusAsync: vi.fn<(name: ServerName | string) => Promise<ContainerStatus>>() };
const consolePort = {
  command: vi.fn<(name: ServerName | string, args: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>>(),
};

vi.mock('../../../src/infrastructure/index.js', () => ({
  getContainer: () => ({ containerRuntime: runtime, serverConsolePort: consolePort }),
}));

import {
  isContainerRunning,
  execRconWithOutput,
  getOnlinePlayers,
  serverOfContainer,
} from '../../../src/lib/rcon.js';

beforeEach(() => {
  runtime.getStatusAsync.mockReset();
  consolePort.command.mockReset();
});

describe('serverOfContainer', () => {
  it('maps mc-<server> to its ServerName', () => {
    const server = serverOfContainer('mc-alpha');
    expect(server).toBeInstanceOf(ServerName);
    expect((server as ServerName).value).toBe('alpha');
  });

  it('keeps a name that is not a server container as the workload name', () => {
    expect(serverOfContainer('alpha')).toBe('alpha');
    expect(serverOfContainer('mc-bad name')).toBe('mc-bad name');
  });
});

describe('isContainerRunning', () => {
  it.each<[ContainerStatus, boolean]>([
    ['running', true],
    // `{{.State.Running}}` is true for paused and restarting containers too
    ['paused', true],
    ['restarting', true],
    ['exited', false],
    ['created', false],
    ['not_found', false],
  ])('status %s -> %s', async (status, expected) => {
    runtime.getStatusAsync.mockResolvedValue(status);

    await expect(isContainerRunning('mc-alpha')).resolves.toBe(expected);
    const arg = runtime.getStatusAsync.mock.calls[0]![0] as ServerName;
    expect(arg.value).toBe('alpha');
  });
});

describe('execRconWithOutput', () => {
  it('runs the command through the console port and returns stdout', async () => {
    consolePort.command.mockResolvedValue({ exitCode: 0, stdout: 'There are 0 of a max 20 players online:', stderr: '' });

    const result = await execRconWithOutput('mc-alpha', ['list']);

    expect(result).toEqual({ code: 0, output: 'There are 0 of a max 20 players online:' });
    const [server, args] = consolePort.command.mock.calls[0]!;
    expect((server as ServerName).value).toBe('alpha');
    expect(args).toEqual(['list']);
  });

  it('falls back to stderr when there is no stdout', async () => {
    consolePort.command.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'spawn docker ENOENT' });

    await expect(execRconWithOutput('mc-alpha', ['list'])).resolves.toEqual({ code: 1, output: 'spawn docker ENOENT' });
  });

  it('feeds the player list parser', async () => {
    consolePort.command.mockResolvedValue({ exitCode: 0, stdout: 'There are 2 of a max 20 players online: Steve, Alex', stderr: '' });

    await expect(getOnlinePlayers('mc-alpha')).resolves.toEqual({ count: 2, maxPlayers: 20, players: ['Steve', 'Alex'] });
  });
});
