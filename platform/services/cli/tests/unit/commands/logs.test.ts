import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IContainerRuntimePort } from '@minecraft-docker/shared';
import { logsCommand } from '../../../src/commands/logs.js';

vi.mock('@minecraft-docker/shared', async () => {
  const actual = await vi.importActual<typeof import('@minecraft-docker/shared')>('@minecraft-docker/shared');
  return {
    ...actual,
    Paths: vi.fn().mockImplementation(() => ({ isInitialized: () => true, root: '/tmp/r' })),
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  };
});

function fakeRuntime(over: Partial<IContainerRuntimePort> = {}): IContainerRuntimePort {
  return {
    exists: vi.fn().mockReturnValue(true),
    followLogs: vi.fn(async (_n: string, onChunk: (c: string) => void) => {
      onChunk('a\n');
      onChunk('java.lang.Exception\nb\n'); // stderr chunk shares the stream
    }),
    ...over,
  } as unknown as IContainerRuntimePort;
}

describe('logsCommand', () => {
  let out: string[];
  const write = (s: string) => void out.push(s);
  beforeEach(() => {
    out = [];
  });

  it('works with no options: last 50 lines of mc-<server>', async () => {
    const runtime = fakeRuntime();
    expect(await logsCommand({ serverName: 'myserver', runtime, write })).toBe(0);
    expect(runtime.followLogs).toHaveBeenCalledWith('mc-myserver', expect.any(Function), expect.any(AbortSignal), {
      follow: false,
      tail: 50, onExit: expect.any(Function)
    });
    expect(out.join('')).toBe('a\njava.lang.Exception\nb\n');
  });

  it('honours -n/--lines', async () => {
    const runtime = fakeRuntime();
    await logsCommand({ serverName: 'myserver', lines: '10', runtime, write });
    expect(runtime.followLogs).toHaveBeenCalledWith('mc-myserver', expect.any(Function), expect.any(AbortSignal), {
      follow: false,
      tail: 10, onExit: expect.any(Function)
    });
  });

  it('rejects a non-numeric --lines', async () => {
    const runtime = fakeRuntime();
    expect(await logsCommand({ serverName: 'myserver', lines: 'abc', runtime, write })).toBe(1);
    expect(runtime.followLogs).not.toHaveBeenCalled();
  });

  it('prints a JSON array of lines with --json', async () => {
    const runtime = fakeRuntime();
    await logsCommand({ serverName: 'myserver', json: true, runtime, write });
    expect(JSON.parse(out.join(''))).toEqual(['a', 'java.lang.Exception', 'b']);
  });

  it('router maps to the mc-router workload', async () => {
    const runtime = fakeRuntime();
    await logsCommand({ serverName: 'router', runtime, write });
    expect(runtime.exists).toHaveBeenCalledWith('mc-router');
    expect(runtime.followLogs).toHaveBeenCalledWith('mc-router', expect.any(Function), expect.any(AbortSignal), {
      follow: false,
      tail: 50, onExit: expect.any(Function)
    });
  });

  it('fails when the workload does not exist', async () => {
    const runtime = fakeRuntime({ exists: vi.fn().mockReturnValue(false) });
    expect(await logsCommand({ serverName: 'ghost', runtime, write })).toBe(1);
    expect(runtime.followLogs).not.toHaveBeenCalled();
  });

  it('requires a server name', async () => {
    expect(await logsCommand({ runtime: fakeRuntime(), write })).toBe(1);
  });

  it('rejects an unsafe server name', async () => {
    const runtime = fakeRuntime();
    expect(await logsCommand({ serverName: '--all', runtime, write })).toBe(1);
    expect(runtime.exists).not.toHaveBeenCalled();
  });

  it('-f tails N lines then follows in one stream and forwards chunks', async () => {
    const followLogs = vi.fn(async (_n: string, onChunk: (c: string) => void) => {
      onChunk('x\n');
    });
    const runtime = fakeRuntime({ followLogs });
    expect(await logsCommand({ serverName: 'myserver', follow: true, lines: '5', runtime, write })).toBe(0);
    expect(followLogs).toHaveBeenCalledWith('mc-myserver', expect.any(Function), expect.any(AbortSignal), { follow: true, tail: 5, onExit: expect.any(Function) });
    expect(out.join('')).toBe('x\n');
  });

  it('ending follow with Ctrl+C (abort) exits 0', async () => {
    const controller = new AbortController();
    const followLogs = vi.fn(
      (_n: string, _c: unknown, signal: AbortSignal) =>
        new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve()))
    );
    const runtime = fakeRuntime({ followLogs: followLogs as never });
    const done = logsCommand({ serverName: 'myserver', follow: true, runtime, write, signal: controller.signal });
    controller.abort();
    expect(await done).toBe(0);
  });

  it('SIGINT aborts follow and exits 0', async () => {
    const followLogs = vi.fn(
      (_n: string, _c: unknown, signal: AbortSignal) =>
        new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve()))
    );
    const runtime = fakeRuntime({ followLogs: followLogs as never });
    const done = logsCommand({ serverName: 'myserver', follow: true, runtime, write });
    await new Promise((r) => setImmediate(r));
    process.emit('SIGINT');
    expect(await done).toBe(0);
  });

  it('refuses --json together with -f', async () => {
    const runtime = fakeRuntime();
    expect(await logsCommand({ serverName: 'myserver', follow: true, json: true, runtime, write })).toBe(1);
    expect(runtime.followLogs).not.toHaveBeenCalled();
  });

  it('returns 1 when docker logs exits non-zero (non-follow)', async () => {
    const runtime = fakeRuntime({
      followLogs: vi.fn(async (_n, _c, _s, o) => o?.onExit?.(1, undefined)) as never,
    });
    expect(await logsCommand({ serverName: 'myserver', runtime, write })).toBe(1);
    expect(out).toEqual([]);
  });

  it('returns 1 on a spawn error (follow)', async () => {
    const runtime = fakeRuntime({
      followLogs: vi.fn(async (_n, _c, _s, o) => o?.onExit?.(null, new Error('ENOENT'))) as never,
    });
    expect(await logsCommand({ serverName: 'myserver', follow: true, runtime, write })).toBe(1);
  });

  it('returns 0 when follow is ended by abort even if docker reports a signal', async () => {
    const controller = new AbortController();
    const followLogs = vi.fn(
      (_n: string, _c: unknown, signal: AbortSignal, o?: { onExit?: (c: number | null) => void }) =>
        new Promise<void>((resolve) =>
          signal.addEventListener('abort', () => {
            o?.onExit?.(null);
            resolve();
          })
        )
    );
    const runtime = fakeRuntime({ followLogs: followLogs as never });
    const done = logsCommand({ serverName: 'myserver', follow: true, runtime, write, signal: controller.signal });
    controller.abort();
    expect(await done).toBe(0);
  });

  it('waits for the output write to finish before returning (pipe truncation)', async () => {
    const big = 'x'.repeat(1000) + '\n';
    const runtime = fakeRuntime({
      followLogs: vi.fn(async (_n: string, onChunk: (c: string) => void) => onChunk(big)) as never,
    });
    let finish!: () => void;
    const write = vi.fn(() => new Promise<void>((r) => (finish = r)));
    let returned = false;
    const done = logsCommand({ serverName: 'myserver', runtime, write }).then((c) => {
      returned = true;
      return c;
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(write).toHaveBeenCalledTimes(1);
    expect(returned).toBe(false);
    finish();
    expect(await done).toBe(0);
  });

  it.each([[true], [undefined as unknown as string, 'missing'], ['-1'], ['0'], ['abc'], ['1.5'], ['']])(
    'rejects invalid --lines %s',
    async (lines) => {
      const runtime = fakeRuntime();
      const opts = lines === undefined ? {} : { lines: lines as never };
      // undefined means the flag is absent (valid); every other value must be rejected
      const code = await logsCommand({ serverName: 'myserver', runtime, write, ...opts });
      expect(code).toBe(lines === undefined ? 0 : 1);
    }
  );
});
