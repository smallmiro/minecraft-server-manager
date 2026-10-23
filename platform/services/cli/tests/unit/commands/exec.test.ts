/**
 * `mcctl exec <server> <cmd...>` runs one RCON command through
 * IServerConsolePort.command (#668, ADR-0001 row 11) instead of an inherited
 * `docker exec`. Output is printed after the command ends.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ServerName, type IServerConsolePort } from '@minecraft-docker/shared';
import { execCommand } from '../../../src/commands/exec.js';

let root = '';
let out = '';
let err = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-exec-'));
  writeFileSync(join(root, 'docker-compose.yml'), 'services: {}\n');
  out = '';
  err = '';
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => ((out += String(chunk)), true));
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => ((err += String(chunk)), true));
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

function consoleReturning(result: { exitCode: number; stdout: string; stderr: string }) {
  return { command: vi.fn(async () => result) } as unknown as IServerConsolePort & { command: ReturnType<typeof vi.fn> };
}

describe('execCommand', () => {
  it('sends the command to the server and prints its output', async () => {
    const consolePort = consoleReturning({ exitCode: 0, stdout: 'There are 0 of a max 20 players online:\n', stderr: '' });

    const code = await execCommand({ root, serverName: 'alpha', command: ['list'], console: consolePort });

    expect(code).toBe(0);
    const [server, args] = consolePort.command.mock.calls[0]!;
    expect(server).toBeInstanceOf(ServerName);
    expect((server as ServerName).value).toBe('alpha');
    expect(args).toEqual(['list']);
    expect(out).toBe('There are 0 of a max 20 players online:\n');
  });

  it('accepts the container name form (mc-<server>)', async () => {
    const consolePort = consoleReturning({ exitCode: 0, stdout: '', stderr: '' });

    await execCommand({ root, serverName: 'mc-alpha', command: ['list'], console: consolePort });

    expect((consolePort.command.mock.calls[0]![0] as ServerName).value).toBe('alpha');
  });

  it('prints stderr and returns the exit code on failure', async () => {
    const consolePort = consoleReturning({ exitCode: 1, stdout: '', stderr: 'Error: No such container: mc-alpha\n' });

    const code = await execCommand({ root, serverName: 'alpha', command: ['list'], console: consolePort });

    expect(code).toBe(1);
    expect(err).toBe('Error: No such container: mc-alpha\n');
  });

  it('still requires a command', async () => {
    const consolePort = consoleReturning({ exitCode: 0, stdout: '', stderr: '' });

    expect(await execCommand({ root, serverName: 'alpha', command: [], console: consolePort })).toBe(1);
    expect(consolePort.command).not.toHaveBeenCalled();
  });
});
