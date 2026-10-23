import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
  execFileSync: vi.fn(),
  execSync: vi.fn(),
  spawn: vi.fn(),
  execFile: vi.fn(),
}));

import { spawnSync, execFileSync, execSync, spawn, execFile } from 'node:child_process';
import {
  DockerComposeRuntimeAdapter,
  DockerServerConsoleAdapter,
  DockerRouterStatusAdapter,
  DockerPlayitAgentAdapter,
  DockerRuntimeEnvironmentAdapter,
} from '../src/infrastructure/adapters/DockerComposeRuntimeAdapter.js';

const PIPE = { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] };

/** spawnSync result as execCommand sees it */
const exited = (status: number, stdout = '') => ({ status, stdout, stderr: '', error: undefined }) as never;

/** Fake ChildProcess that emits nothing on its own */
function bareChild() {
  return Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(),
  });
}

/** Fake ChildProcess that exits on the next tick with the given output */
function fakeChild(code: number | null, stdout = '', stderr = '') {
  const child = bareChild();
  setImmediate(() => {
    if (stdout) child.stdout.emit('data', Buffer.from(stdout));
    if (stderr) child.stderr.emit('data', Buffer.from(stderr));
    child.emit('close', code);
  });
  return child as never;
}

const throws = () => {
  throw new Error('exit 1');
};

/** promisify(execFile) on the mock: the callback is the last argument */
const execFileCalls = (...results: Array<{ stdout?: string; stderr?: string } | Error>) => {
  for (const result of results) {
    vi.mocked(execFile).mockImplementationOnce(((...args: unknown[]) => {
      const callback = args[args.length - 1] as (err: Error | null, value?: unknown) => void;
      if (result instanceof Error) callback(result);
      else callback(null, { stdout: result.stdout ?? '', stderr: result.stderr ?? '' });
    }) as never);
  }
};

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('DockerComposeRuntimeAdapter (leaf queries)', () => {
  const runtime = new DockerComposeRuntimeAdapter();

  const INSPECT = [
    {
      method: 'getStatus',
      run: (n: string) => runtime.getStatus(n),
      format: '{{.State.Status}}',
      stdout: 'running\n',
      ok: 'running',
      failed: 'not_found',
    },
    {
      method: 'getHealth',
      run: (n: string) => runtime.getHealth(n),
      format: '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}',
      stdout: 'healthy\n',
      ok: 'healthy',
      failed: 'unknown',
    },
  ];

  for (const c of INSPECT) {
    it(`${c.method} runs docker inspect with the exact argv`, () => {
      vi.mocked(spawnSync).mockReturnValue(exited(0, c.stdout));
      expect(c.run('mc-a')).toBe(c.ok);
      expect(spawnSync).toHaveBeenCalledWith('docker', ['inspect', '--format', c.format, '--', 'mc-a'], PIPE);
    });

    it(`${c.method} returns '${c.failed}' when docker fails`, () => {
      vi.mocked(spawnSync).mockReturnValue(exited(1));
      expect(c.run('mc-a')).toBe(c.failed);
    });
  }

  it('exists maps the docker inspect exit code to a boolean', () => {
    expect(runtime.exists('mc-a')).toBe(true);
    expect(execFileSync).toHaveBeenCalledWith('docker', ['inspect', '--', 'mc-a'], { stdio: 'pipe' });
    vi.mocked(execFileSync).mockImplementation(throws);
    expect(runtime.exists('mc-a')).toBe(false);
  });

  it('list returns server containers sorted, without mc-router', () => {
    vi.mocked(spawnSync).mockReturnValue(exited(0, 'mc-b\nmc-router\nmc-a\n'));
    expect(runtime.list()).toEqual(['mc-a', 'mc-b']);
    expect(spawnSync).toHaveBeenCalledWith(
      'docker',
      ['ps', '-a', '--filter', 'name=mc-', '--format', '{{.Names}}'],
      PIPE
    );
  });

  it('list({ running: true }) filters running containers', () => {
    vi.mocked(spawnSync).mockReturnValue(exited(0, 'mc-a\n'));
    expect(runtime.list({ running: true })).toEqual(['mc-a']);
    expect(spawnSync).toHaveBeenCalledWith(
      'docker',
      ['ps', '--filter', 'name=mc-', '--filter', 'status=running', '--format', '{{.Names}}'],
      PIPE
    );
  });

  it('list returns [] when docker fails', () => {
    vi.mocked(spawnSync).mockReturnValue(exited(1));
    expect(runtime.list()).toEqual([]);
    expect(runtime.list({ running: true })).toEqual([]);
  });

  it('getLogs tails 50 lines by default and returns "" on failure', () => {
    vi.mocked(spawnSync).mockReturnValue(exited(0, 'line1\nline2\n'));
    expect(runtime.getLogs('mc-a')).toBe('line1\nline2');
    expect(spawnSync).toHaveBeenCalledWith('docker', ['logs', '--tail', '50', '--', 'mc-a'], PIPE);
    runtime.getLogs('mc-a', 20);
    expect(spawnSync).toHaveBeenLastCalledWith('docker', ['logs', '--tail', '20', '--', 'mc-a'], PIPE);
    vi.mocked(spawnSync).mockReturnValue(exited(1));
    expect(runtime.getLogs('mc-a')).toBe('');
  });

  it('getStats parses docker stats output', () => {
    vi.mocked(spawnSync).mockReturnValue(exited(0, '2GiB / 4GiB,15.23%\n'));
    expect(runtime.getStats('mc-a')).toEqual({
      memoryUsage: 2 * 1024 ** 3,
      memoryLimit: 4 * 1024 ** 3,
      memoryPercent: 50,
      cpuPercent: 15.23,
    });
    expect(spawnSync).toHaveBeenCalledWith(
      'docker',
      ['stats', '--no-stream', '--format', '{{.MemUsage}},{{.CPUPerc}}', '--', 'mc-a'],
      PIPE
    );
  });

  it('getStats returns null on failure or unparseable output', () => {
    vi.mocked(spawnSync).mockReturnValue(exited(1));
    expect(runtime.getStats('mc-a')).toBeNull();
    vi.mocked(spawnSync).mockReturnValue(exited(0, 'garbage'));
    expect(runtime.getStats('mc-a')).toBeNull();
  });

  describe('getUptime', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-21T12:30:00Z'));
    });
    afterEach(() => vi.useRealTimers());

    it('formats the time since StartedAt', () => {
      vi.mocked(spawnSync).mockReturnValue(exited(0, '2026-10-20T10:00:00Z\n'));
      expect(runtime.getUptime('mc-a')).toEqual({ uptime: '1d 2h 30m', seconds: 95400 });
      expect(spawnSync).toHaveBeenCalledWith(
        'docker',
        ['inspect', '--format', '{{.State.StartedAt}}', '--', 'mc-a'],
        PIPE
      );
    });

    it('returns null on failure or for a never-started container', () => {
      vi.mocked(spawnSync).mockReturnValue(exited(1));
      expect(runtime.getUptime('mc-a')).toBeNull();
      vi.mocked(spawnSync).mockReturnValue(exited(0, '0001-01-01T00:00:00Z'));
      expect(runtime.getUptime('mc-a')).toBeNull();
    });
  });

  it('deprecated startContainer/stopContainer run docker start/stop', () => {
    expect(runtime.startContainer('mc-a')).toBe(true);
    expect(execFileSync).toHaveBeenCalledWith('docker', ['start', '--', 'mc-a'], { stdio: 'pipe' });
    expect(runtime.stopContainer('mc-a')).toBe(true);
    expect(execFileSync).toHaveBeenCalledWith('docker', ['stop', '--', 'mc-a'], { stdio: 'pipe' });
    vi.mocked(execFileSync).mockImplementation(throws);
    expect(runtime.startContainer('mc-a')).toBe(false);
    expect(runtime.stopContainer('mc-a')).toBe(false);
  });
});

describe('DockerComposeRuntimeAdapter lifecycle', () => {
  const env = () => ({ PATH: '/bin', SECRET: 'x' });
  const runtime = new DockerComposeRuntimeAdapter({ root: '/srv/mc', env });
  const COMPOSE = { cwd: '/srv/mc', timeout: 60000, env: { PATH: '/bin', SECRET: 'x', COMPOSE_FILE: 'docker-compose.yml' } };
  const failure = () => Object.assign(new Error('Command failed'), { stdout: ' o \n', stderr: ' e \n' });

  it('start runs compose up -d in the root with COMPOSE_FILE', async () => {
    execFileCalls({ stdout: 'up\n', stderr: ' Container mc-a Started \n' });
    expect(await runtime.start('mc-a')).toEqual({ success: true, stdout: 'up', stderr: 'Container mc-a Started' });
    expect(execFile).toHaveBeenCalledWith('docker', ['compose', 'up', '-d', 'mc-a'], COMPOSE, expect.any(Function));
  });

  it('restart runs compose restart in the root with COMPOSE_FILE', async () => {
    execFileCalls({});
    expect(await runtime.restart('mc-a')).toEqual({ success: true, stdout: '', stderr: '' });
    expect(execFile).toHaveBeenCalledWith('docker', ['compose', 'restart', 'mc-a'], COMPOSE, expect.any(Function));
  });

  it('stop runs docker stop -- <name> with env and no timeout', async () => {
    execFileCalls({});
    expect(await runtime.stop('mc-a')).toEqual({ success: true, stdout: '', stderr: '' });
    expect(execFile).toHaveBeenCalledWith('docker', ['stop', '--', 'mc-a'], { env: env() }, expect.any(Function));
  });

  it('never rejects: failures become success false with trimmed output', async () => {
    execFileCalls(failure(), failure(), failure());
    const failed = { success: false, stdout: 'o', stderr: 'e', error: 'Command failed' };
    expect(await runtime.start('mc-a')).toEqual(failed);
    expect(await runtime.stop('mc-a')).toEqual(failed);
    expect(await runtime.restart('mc-a')).toEqual(failed);
  });

  it('defaults root to MCCTL_ROOT at call time and env to process.env', async () => {
    vi.stubEnv('MCCTL_ROOT', '/opt/mcctl');
    execFileCalls({}, {});
    const defaults = new DockerComposeRuntimeAdapter();
    await defaults.start('mc-a');
    expect(execFile).toHaveBeenLastCalledWith(
      'docker',
      ['compose', 'up', '-d', 'mc-a'],
      { cwd: '/opt/mcctl', timeout: 60000, env: { ...process.env, COMPOSE_FILE: 'docker-compose.yml' } },
      expect.any(Function)
    );
    await defaults.stop('mc-a');
    expect(execFile).toHaveBeenLastCalledWith('docker', ['stop', '--', 'mc-a'], { env: process.env }, expect.any(Function));
  });
});

describe('DockerComposeRuntimeAdapter.readLogs', () => {
  const runtime = new DockerComposeRuntimeAdapter();

  it('returns non-empty timestamped lines', async () => {
    execFileCalls({ stdout: '2026-10-23T00:00:00Z a\n\n2026-10-23T00:00:01Z b\n' });
    expect(await runtime.readLogs('mc-a', { since: '24h', tail: 10000 })).toEqual([
      '2026-10-23T00:00:00Z a',
      '2026-10-23T00:00:01Z b',
    ]);
    expect(execFile).toHaveBeenCalledWith(
      'docker',
      ['logs', '--timestamps', '--since', '24h', '--tail', '10000', '--', 'mc-a'],
      { timeout: 10000, maxBuffer: 10 * 1024 * 1024 },
      expect.any(Function)
    );
  });

  it('rejects when docker logs fails', async () => {
    execFileCalls(new Error('boom'));
    await expect(runtime.readLogs('mc-a', { since: '24h', tail: 10 })).rejects.toThrow('boom');
  });
});

describe('DockerComposeRuntimeAdapter.followLogs', () => {
  const runtime = new DockerComposeRuntimeAdapter();

  it('forwards stdout and stderr chunks and resolves on close', async () => {
    const child = bareChild();
    vi.mocked(spawn).mockReturnValue(child as never);
    const chunks: string[] = [];
    const controller = new AbortController();

    const done = runtime.followLogs('mc-a', (c) => chunks.push(c), controller.signal);
    child.stdout.emit('data', Buffer.from('out\n'));
    child.stderr.emit('data', Buffer.from('err\n'));
    child.emit('close', 0);
    await done;

    expect(chunks).toEqual(['out\n', 'err\n']);
    expect(spawn).toHaveBeenCalledWith('docker', ['logs', '-f', '--tail', '0', '--', 'mc-a'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: controller.signal,
    });
  });

  it('resolves on a spawn error', async () => {
    const child = bareChild();
    vi.mocked(spawn).mockReturnValue(child as never);
    const done = runtime.followLogs('mc-a', () => {}, new AbortController().signal);
    child.emit('error', new Error('spawn docker ENOENT'));
    await expect(done).resolves.toBeUndefined();
  });

  it('stops forwarding once aborted', async () => {
    const child = bareChild();
    vi.mocked(spawn).mockReturnValue(child as never);
    const chunks: string[] = [];
    const controller = new AbortController();
    const done = runtime.followLogs('mc-a', (c) => chunks.push(c), controller.signal);
    controller.abort();
    child.stdout.emit('data', Buffer.from('late\n'));
    child.emit('close', null);
    await done;
    expect(chunks).toEqual([]);
  });

  it('abort kills the child and resolves', async () => {
    const real = await vi.importActual<typeof import('node:child_process')>('node:child_process');
    let pid: number | undefined;
    vi.mocked(spawn).mockImplementation(((_file: string, _args: string[], options: object) => {
      const child = real.spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], options);
      pid = child.pid;
      return child;
    }) as never);
    const controller = new AbortController();
    const done = runtime.followLogs('mc-a', () => {}, controller.signal);
    controller.abort();
    await done;
    await new Promise((r) => setTimeout(r, 100));
    expect(pid).toBeDefined();
    expect(() => process.kill(pid!, 0)).toThrow();
  });
});

describe('DockerServerConsoleAdapter.command', () => {
  const rcon = new DockerServerConsoleAdapter();

  it('runs rcon-cli in the container with the args after --', async () => {
    vi.mocked(spawn).mockImplementation(() => fakeChild(0, 'Saved the game\n'));
    expect(await rcon.command('mc-a', ['save-all', 'flush'])).toEqual({
      exitCode: 0,
      stdout: 'Saved the game\n',
      stderr: '',
    });
    expect(spawn).toHaveBeenCalledWith('docker', ['exec', '--', 'mc-a', 'rcon-cli', 'save-all', 'flush'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  });

  it('keeps the exit code and stderr of a failed command', async () => {
    vi.mocked(spawn).mockImplementation(() => fakeChild(2, '', 'bad'));
    expect(await rcon.command('mc-a', ['x'])).toEqual({ exitCode: 2, stdout: '', stderr: 'bad' });
    vi.mocked(spawn).mockImplementation(() => fakeChild(null));
    expect((await rcon.command('mc-a', ['x'])).exitCode).toBe(1);
  });

  it('never rejects: a spawn error becomes exitCode 1 with the message', async () => {
    const child = bareChild();
    vi.mocked(spawn).mockReturnValue(child as never);
    const result = rcon.command('mc-a', ['list']);
    child.emit('error', new Error('spawn docker ENOENT'));
    expect(await result).toEqual({ exitCode: 1, stdout: '', stderr: 'spawn docker ENOENT' });
  });
});

describe('DockerServerConsoleAdapter.getEndpoint', () => {
  const rcon = new DockerServerConsoleAdapter();
  const IP = ['inspect', '--format', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}', '--', 'mc-a'];
  const ENV = ['inspect', '--format', '{{range .Config.Env}}{{println .}}{{end}}', '--', 'mc-a'];

  it('reads the container IP and RCON settings', async () => {
    execFileCalls({ stdout: '172.18.0.5\n' }, { stdout: 'PATH=/bin\nRCON_PORT=25576\nRCON_PASSWORD=a=b\n' });
    expect(await rcon.getEndpoint('mc-a')).toEqual({ host: '172.18.0.5', port: 25576, password: 'a=b' });
    expect(execFile).toHaveBeenNthCalledWith(1, 'docker', IP, expect.any(Function));
    expect(execFile).toHaveBeenNthCalledWith(2, 'docker', ENV, expect.any(Function));
  });

  it('defaults the port to 25575 and the password to empty', async () => {
    execFileCalls({ stdout: '172.18.0.5\n' }, { stdout: 'PATH=/bin\n' });
    expect(await rcon.getEndpoint('mc-a')).toEqual({ host: '172.18.0.5', port: 25575, password: '' });
  });

  it('returns null without an IP or when inspect fails', async () => {
    execFileCalls({ stdout: '\n' });
    expect(await rcon.getEndpoint('mc-a')).toBeNull();
    expect(execFile).toHaveBeenCalledTimes(1);
    execFileCalls(new Error('No such object'));
    expect(await rcon.getEndpoint('mc-a')).toBeNull();
    execFileCalls({ stdout: '172.18.0.5\n' }, new Error('No such object'));
    expect(await rcon.getEndpoint('mc-a')).toBeNull();
  });
});

describe('DockerServerConsoleAdapter.listPlayers', () => {
  const console_ = new DockerServerConsoleAdapter();

  it('parses rcon-cli list output', async () => {
    vi.mocked(execFileSync).mockReturnValue('There are 1 of a max of 20 players online: Steve\n');
    expect(await console_.listPlayers('mc-a')).toEqual({ online: 1, max: 20, players: ['Steve'] });
    expect(execFileSync).toHaveBeenCalledWith('docker', ['exec', '--', 'mc-a', 'rcon-cli', 'list'], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  });

  it('returns null when rcon-cli fails', async () => {
    vi.mocked(execFileSync).mockImplementation(throws);
    expect(await console_.listPlayers('mc-a')).toBeNull();
  });
});

describe('DockerRouterStatusAdapter', () => {
  const router = new DockerRouterStatusAdapter();
  const CURL = ['-s', '-o', '/dev/null', '-w', '%{http_code}', 'http://127.0.0.1:25580/routes'];
  const PROBE = { encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] };

  const probes = (status: string, curl: ReturnType<typeof exited>, wget = exited(1)) =>
    vi.mocked(spawnSync).mockImplementation(((cmd: string) =>
      cmd === 'docker' ? exited(0, status) : cmd === 'curl' ? curl : wget) as never);

  it("getHealth is 'unknown' when mc-router is not running", () => {
    probes('exited', exited(0, '200'));
    expect(router.getHealth()).toBe('unknown');
    expect(spawnSync).toHaveBeenCalledWith('docker', ['inspect', '--format', '{{.State.Status}}', '--', 'mc-router'], PIPE);
    expect(spawnSync).not.toHaveBeenCalledWith('curl', expect.anything(), expect.anything());
  });

  it('getHealth probes the management API with curl', () => {
    probes('running', exited(0, '200'));
    expect(router.getHealth()).toBe('healthy');
    expect(spawnSync).toHaveBeenCalledWith('curl', CURL, PROBE);
    probes('running', exited(0, '500'));
    expect(router.getHealth()).toBe('unhealthy');
  });

  it('getHealth falls back to wget when curl fails', () => {
    probes('running', exited(1), exited(0));
    expect(router.getHealth()).toBe('healthy');
    expect(spawnSync).toHaveBeenCalledWith('wget', ['-q', '-O', '/dev/null', 'http://127.0.0.1:25580/routes'], PROBE);
    probes('running', exited(1), exited(1));
    expect(router.getHealth()).toBe('unhealthy');
  });

  it("getHostnames reads the mc-router.host label, '-' when absent", () => {
    vi.mocked(spawnSync).mockReturnValue(exited(0, 'a.local,b.nip.io\n'));
    expect(router.getHostnames('mc-a')).toBe('a.local,b.nip.io');
    expect(spawnSync).toHaveBeenCalledWith(
      'docker',
      ['inspect', '--format', '{{index .Config.Labels "mc-router.host"}}', '--', 'mc-a'],
      PIPE
    );
    vi.mocked(spawnSync).mockReturnValue(exited(1));
    expect(router.getHostnames('mc-a')).toBe('-');
  });
});

describe('DockerPlayitAgentAdapter', () => {
  const playit = new DockerPlayitAgentAdapter({ root: '/srv/mc' });
  const SPAWN = { stdio: ['pipe', 'pipe', 'pipe'], cwd: '/srv/mc' };

  it('start runs compose up with the playit profile in the root', async () => {
    vi.mocked(spawn).mockImplementation(() => fakeChild(0));
    expect(await playit.start()).toEqual({ success: true });
    expect(spawn).toHaveBeenCalledWith('docker', ['compose', '--profile', 'playit', 'up', '-d', 'playit'], SPAWN);
  });

  it('start reports stderr (else stdout) on failure', async () => {
    vi.mocked(spawn).mockImplementation(() => fakeChild(1, 'out', 'boom'));
    expect(await playit.start()).toEqual({ success: false, error: 'boom' });
    vi.mocked(spawn).mockImplementation(() => fakeChild(1, 'out'));
    expect(await playit.start()).toEqual({ success: false, error: 'out' });
  });

  it('stop runs compose stop and maps the exit code', async () => {
    vi.mocked(spawn).mockImplementation(() => fakeChild(0));
    expect(await playit.stop()).toBe(true);
    expect(spawn).toHaveBeenCalledWith('docker', ['compose', '--profile', 'playit', 'stop', 'playit'], SPAWN);
    vi.mocked(spawn).mockImplementation(() => fakeChild(1));
    expect(await playit.stop()).toBe(false);
  });

  it('defaults root to MCCTL_ROOT at call time', async () => {
    vi.stubEnv('MCCTL_ROOT', '/opt/mcctl');
    vi.mocked(spawn).mockImplementation(() => fakeChild(0));
    await new DockerPlayitAgentAdapter().stop();
    expect(spawn).toHaveBeenCalledWith('docker', expect.any(Array), { stdio: ['pipe', 'pipe', 'pipe'], cwd: '/opt/mcctl' });
  });
});

describe('DockerRuntimeEnvironmentAdapter', () => {
  const environment = new DockerRuntimeEnvironmentAdapter();
  const VERSION = { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] };

  it('isAvailable runs docker info', () => {
    expect(environment.isAvailable()).toBe(true);
    expect(execSync).toHaveBeenCalledWith('docker info', { stdio: 'pipe' });
    vi.mocked(execSync).mockImplementation(throws);
    expect(environment.isAvailable()).toBe(false);
  });

  it('deprecated isComposeAvailable runs docker compose version', () => {
    expect(environment.isComposeAvailable()).toBe(true);
    expect(execSync).toHaveBeenCalledWith('docker compose version', { stdio: 'pipe' });
    vi.mocked(execSync).mockImplementation(throws);
    expect(environment.isComposeAvailable()).toBe(false);
  });

  it('getEngineVersion returns the server version', () => {
    vi.mocked(execSync).mockReturnValue('27.3.1\n');
    expect(environment.getEngineVersion()).toEqual({ installed: true, version: '27.3.1' });
    expect(execSync).toHaveBeenCalledWith('docker version --format {{.Server.Version}}', VERSION);
    vi.mocked(execSync).mockReturnValue('');
    expect(environment.getEngineVersion()).toEqual({ installed: true, version: undefined });
    vi.mocked(execSync).mockImplementation(throws);
    expect(environment.getEngineVersion()).toEqual({ installed: false });
  });

  it("getComposeVersion strips a leading 'v'", () => {
    vi.mocked(execSync).mockReturnValue('v2.29.7\n');
    expect(environment.getComposeVersion()).toEqual({ installed: true, version: '2.29.7' });
    expect(execSync).toHaveBeenCalledWith('docker compose version --short', VERSION);
    vi.mocked(execSync).mockImplementation(throws);
    expect(environment.getComposeVersion()).toEqual({ installed: false });
  });
});

describe('package exports', () => {
  it('exports the adapter classes, not instances, from the package root', async () => {
    const shared = await import('../src/index.js');
    for (const name of [
      'DockerComposeRuntimeAdapter',
      'DockerServerConsoleAdapter',
      'DockerRouterStatusAdapter',
      'DockerPlayitAgentAdapter',
      'DockerRuntimeEnvironmentAdapter',
    ]) {
      expect(typeof (shared as Record<string, unknown>)[name]).toBe('function');
    }
  });
});
