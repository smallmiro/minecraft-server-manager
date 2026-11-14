/**
 * execRcon runs through the server console port (#875). #672: a command
 * whose `docker exec` never returns is aborted at its timeout and reported as
 * a failure, not left hanging.
 */
import { describe, it, expect } from 'vitest';
import { execRcon, execRconCommand } from '../src/lib/rcon.js';
import { FakeServerConsole, hangUntilAborted } from './fake-console.js';

describe('execRcon timeout (#672)', () => {
  it('aborts a hung command and returns a failed result', async () => {
    const serverConsole = new FakeServerConsole();
    serverConsole.reply = hangUntilAborted;

    const started = Date.now();
    const result = await execRcon(serverConsole, 'mc-alpha', 'list', 200);

    expect(Date.now() - started).toBeLessThan(2_000);
    expect(serverConsole.calls[0].signal?.aborted).toBe(true);
    expect(result).toEqual({ exitCode: 1, output: 'RCON command timed out after 200 ms' });
  });
});

describe('execRcon through the console port (#875)', () => {
  it('passes the command as one argument to the mc- container', async () => {
    const serverConsole = new FakeServerConsole();

    await execRcon(serverConsole, 'alpha', 'say hello world');
    await execRcon(serverConsole, 'mc-alpha', '--host=evil.example');

    expect(serverConsole.calls.map(({ name, args }) => ({ name, args }))).toEqual([
      { name: 'mc-alpha', args: ['say hello world'] },
      { name: 'mc-alpha', args: ['--host=evil.example'] },
    ]);
  });

  it('returns stdout, or stderr when stdout is empty, with the exit code', async () => {
    const serverConsole = new FakeServerConsole();
    serverConsole.reply = async () => ({ exitCode: 0, stdout: 'There are 0 players', stderr: 'ignored' });
    expect(await execRcon(serverConsole, 'alpha', 'list')).toEqual({ exitCode: 0, output: 'There are 0 players' });

    serverConsole.reply = async () => ({ exitCode: 1, stdout: '', stderr: 'Connection refused' });
    expect(await execRcon(serverConsole, 'alpha', 'list')).toEqual({ exitCode: 1, output: 'Connection refused' });
  });

  it('execRconCommand returns the trimmed output', async () => {
    const serverConsole = new FakeServerConsole();
    serverConsole.reply = async () => ({ exitCode: 0, stdout: '  Added Steve to the whitelist\n', stderr: '' });

    expect(await execRconCommand(serverConsole, 'alpha', 'whitelist add Steve')).toBe('Added Steve to the whitelist');
  });
});
