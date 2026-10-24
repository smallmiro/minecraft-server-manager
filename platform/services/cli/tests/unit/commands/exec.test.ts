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
  // Like a terminal: take the chunk and call back
  const capture = (append: (s: string) => void) =>
    ((chunk: unknown, cb?: () => void) => {
      append(String(chunk));
      cb?.();
      return true;
    }) as typeof process.stdout.write;
  vi.spyOn(process.stdout, 'write').mockImplementation(capture((s) => (out += s)));
  vi.spyOn(process.stderr, 'write').mockImplementation(capture((s) => (err += s)));
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

  it('returns only after the output is written, so process.exit does not cut a piped reply (#760 review)', async () => {
    const consolePort = consoleReturning({ exitCode: 0, stdout: 'big reply\n', stderr: 'warn\n' });
    const flush: Array<() => void> = [];
    // A pipe: write() queues the chunk and calls back later
    vi.mocked(process.stdout.write).mockImplementation(((_chunk: unknown, cb?: () => void) => {
      if (cb) flush.push(cb);
      return false;
    }) as typeof process.stdout.write);
    vi.mocked(process.stderr.write).mockImplementation(((_chunk: unknown, cb?: () => void) => {
      if (cb) flush.push(cb);
      return false;
    }) as typeof process.stderr.write);

    let done = false;
    const running = execCommand({ root, serverName: 'alpha', command: ['banlist'], console: consolePort }).then((code) => {
      done = true;
      return code;
    });
    await vi.waitFor(() => expect(flush.length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 10));
    expect(done).toBe(false);

    while (!done) {
      flush.splice(0).forEach((cb) => cb());
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(await running).toBe(0);
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
