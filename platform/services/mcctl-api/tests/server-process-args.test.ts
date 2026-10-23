import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Server create/delete hand user input to scripts (#720). These tests run the
 * real child process against fake scripts that record their argv, so a value
 * that a shell would interpret shows up as a side effect.
 */

const ROOT = mkdtempSync(join(tmpdir(), 'mcctl-api-process-args-'));
const SCRIPTS = join(ROOT, 'scripts');

process.env.MCCTL_ROOT = ROOT;
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

// Spy on the real functions: the processes still run.
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, exec: vi.fn(actual.exec), execFile: vi.fn(actual.execFile) };
});

vi.mock('@minecraft-docker/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@minecraft-docker/shared')>()),
  serverExists: vi.fn(),
  getContainerStatus: vi.fn(() => 'not_found'),
  stopContainer: vi.fn(),
}));

// Never fall through to a real (bundled or deployed) create/delete script.
vi.mock('../src/lib/script-resolver.js', () => ({
  resolveScriptPath: (scriptName: string) => ({
    scriptPath: join(SCRIPTS, scriptName),
    scriptsDir: SCRIPTS,
  }),
}));

vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { exec, execFile } from 'child_process';
import { serverExists } from '@minecraft-docker/shared';

const ARGV_FILE = join(ROOT, 'argv');

/** argv the fake script received, one entry per argument. */
function recordedArgv(): string[] {
  return readFileSync(ARGV_FILE, 'utf-8').split('\0').slice(0, -1);
}

const pwned = (tag: string) => existsSync(join(ROOT, `pwned-${tag}`));

describe('Server scripts receive user input as argv, not shell text (#720)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    mkdirSync(join(ROOT, 'backups', 'meta'), { recursive: true });
    mkdirSync(SCRIPTS, { recursive: true });
    for (const name of ['create-server.sh', 'delete-server.sh']) {
      const script = join(SCRIPTS, name);
      writeFileSync(script, `#!/bin/bash\nprintf '%s\\0' "$@" > "${ARGV_FILE}"\n`);
      chmodSync(script, 0o755);
    }

    const { config } = await import('../src/config/index.js');
    (config as any).mcctlRoot = ROOT;

    const { buildApp } = await import('../src/app.js');
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    rmSync(ROOT, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    rmSync(ARGV_FILE, { force: true });
  });

  describe('POST /api/servers (non-streaming)', () => {
    it('passes seed and modpack version through untouched', async () => {
      vi.mocked(serverExists).mockReturnValue(false);
      const seed = `-123"; touch "${ROOT}/pwned-seed"; echo "`;
      const modpackVersion = `1.0 $(touch ${ROOT}/pwned-modpack) \`touch ${ROOT}/pwned-tick\``;

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers',
        payload: {
          name: 'argv-test',
          type: 'MODRINTH',
          version: '1.21.1',
          seed,
          modpack: 'fabric-example',
          modpackVersion,
          autoStart: false,
        },
      });

      expect(response.statusCode).toBe(201);
      expect(recordedArgv()).toEqual([
        'argv-test',
        '-t', 'MODRINTH',
        '-v', '1.21.1',
        '-s', seed,
        '--modpack', 'fabric-example',
        '--modpack-version', modpackVersion,
        '--no-start',
      ]);
      expect(pwned('seed')).toBe(false);
      expect(pwned('modpack')).toBe(false);
      expect(pwned('tick')).toBe(false);
      expect(exec).not.toHaveBeenCalled();
      expect(execFile).toHaveBeenCalledWith(
        'bash',
        [join(SCRIPTS, 'create-server.sh'), ...recordedArgv()],
        expect.objectContaining({ cwd: ROOT, timeout: 120000 }),
        expect.any(Function)
      );
    });

    it('passes a world URL with command substitution untouched', async () => {
      vi.mocked(serverExists).mockReturnValue(false);
      const worldUrl = 'http://example.com/w.zip?$(touch$IFS$MCCTL_ROOT/pwned-url)';

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers',
        payload: { name: 'argv-test', worldUrl },
      });

      expect(response.statusCode).toBe(201);
      expect(recordedArgv()).toEqual(['argv-test', '-u', worldUrl]);
      expect(pwned('url')).toBe(false);
      expect(exec).not.toHaveBeenCalled();
    });
  });

  describe('create option limits', () => {
    const create = (payload: Record<string, unknown>) =>
      app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'argv-test', ...payload } });

    // create-server.sh writes these into config.env as KEY=value lines (and
    // VERSION through sed), so a line break would add another setting.
    it.each([
      { version: '1.21"; id; "' },
      { version: '1.21\nEULA=FALSE' },
      { version: '1.21/x' },
      { version: '-1.21' },
      { version: '1'.repeat(65) },
      { seed: '123\nRCON_PASSWORD=x' },
      { seed: '123\r' },
      { seed: 'x'.repeat(257) },
      { type: 'MODRINTH', modpack: 'pack', modpackVersion: '1.0\nMODS=http://evil/x.jar' },
      { type: 'MODRINTH', modpack: 'pack', modpackVersion: 'x'.repeat(129) },
      { worldUrl: 'http://example.com/w.zip\nEULA=FALSE' },
    ])('rejects %j', async (payload) => {
      vi.mocked(serverExists).mockReturnValue(false);
      const response = await create(payload);
      expect(response.statusCode).toBe(400);
      expect(execFile).not.toHaveBeenCalled();
    });

    it.each([
      { version: '1.21.1' },
      { version: 'LATEST' },
      { version: '24w14a' },
      { version: '1.20.5-rc1' },
      { seed: '-123' },
      { seed: '-9223372036854775808' },
      { seed: 'a long text seed with spaces, commas & symbols! '.repeat(5) },
      { type: 'MODRINTH', modpack: 'pack', modpackVersion: '0.5.1+1.20.1' },
      { type: 'MODRINTH', modpack: 'pack', modpackVersion: 'Release 5 (beta)' },
    ])('accepts %j', async (payload) => {
      vi.mocked(serverExists).mockReturnValue(false);
      const response = await create(payload);
      expect(response.statusCode).toBe(201);
      expect(recordedArgv()).toEqual(expect.arrayContaining(Object.values(payload)));
    });
  });

  describe('DELETE /api/servers/:name', () => {
    it('runs delete-server.sh with the name as one argument', async () => {
      vi.mocked(serverExists).mockReturnValue(true);

      const response = await app.inject({ method: 'DELETE', url: '/api/servers/My_Server' });

      expect(response.statusCode).toBe(200);
      expect(recordedArgv()).toEqual(['My_Server', '--force']);
      expect(exec).not.toHaveBeenCalled();
      expect(execFile).toHaveBeenCalledWith(
        'bash',
        [join(SCRIPTS, 'delete-server.sh'), 'My_Server', '--force'],
        expect.objectContaining({ cwd: ROOT, timeout: 60000 }),
        expect.any(Function)
      );
    });

    it('passes --delete-world only when deleteWorld=true (#652)', async () => {
      vi.mocked(serverExists).mockReturnValue(true);

      const keep = await app.inject({ method: 'DELETE', url: '/api/servers/alpha?deleteWorld=false' });
      expect(keep.statusCode).toBe(200);
      expect(recordedArgv()).toEqual(['alpha', '--force']);

      const drop = await app.inject({ method: 'DELETE', url: '/api/servers/alpha?deleteWorld=true' });
      expect(drop.statusCode).toBe(200);
      expect(recordedArgv()).toEqual(['alpha', '--force', '--delete-world']);
    });
  });
});
