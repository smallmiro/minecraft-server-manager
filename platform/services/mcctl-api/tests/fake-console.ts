/**
 * A fake IServerConsolePort (#875) for buildApp({ container: { serverConsole } })
 * and the lib/rcon helpers: records each command and answers with `reply`, so
 * no test runs `docker exec`.
 */
import type { ConsoleCommandResult, IServerConsolePort, ServerName } from '@minecraft-docker/shared';

export type ConsoleReply = (args: string[], signal?: AbortSignal) => Promise<ConsoleCommandResult>;

export class FakeServerConsole implements IServerConsolePort {
  readonly calls: Array<{ name: string; args: string[]; signal?: AbortSignal }> = [];
  reply: ConsoleReply = async () => ({ exitCode: 0, stdout: '', stderr: '' });

  async listPlayers(): Promise<null> {
    return null;
  }

  async getEndpoint(): Promise<null> {
    return null;
  }

  command(name: ServerName | string, args: string[], options: { signal?: AbortSignal } = {}): Promise<ConsoleCommandResult> {
    this.calls.push({ name: typeof name === 'string' ? name : name.value, args, signal: options.signal });
    return this.reply(args, options.signal);
  }
}

/** Answers like a `docker exec` that never returns: it ends only when its signal aborts. */
export const hangUntilAborted: ConsoleReply = (_args, signal) =>
  new Promise((resolve) => {
    signal?.addEventListener('abort', () => resolve({ exitCode: 1, stdout: '', stderr: 'The operation was aborted' }), {
      once: true,
    });
  });
