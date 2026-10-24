/**
 * `mcctl migrate worlds` checks and stops running servers through the
 * runtime port (#668, ADR-0001 row 14) instead of `docker inspect` / `docker stop`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chmodSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ConfigEnvWorldAssignmentAdapter,
  FileServerSpecRepository,
  Paths,
  ServerName,
  type IContainerRuntimePort,
  type ServerSpecDocument,
} from '@minecraft-docker/shared';

const runtime = {
  getStatusAsync: vi.fn(),
  stop: vi.fn(),
};
let root = '';

vi.mock('../../../src/infrastructure/index.js', () => ({
  getContainer: () => ({
    containerRuntime: runtime,
    promptPort: { isCancel: () => false, confirm: vi.fn(), select: vi.fn() },
    worldAssignmentPort: new ConfigEnvWorldAssignmentAdapter(new Paths(root)),
  }),
}));

import { migrateCommand } from '../../../src/commands/migrate.js';
import { serverSpecRepositories } from '../../../src/lib/server-config.js';
import { migrateSpec } from '../../../src/commands/migrate-spec.js';

const TEMPLATE_COMPOSE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../templates/servers/_template/docker-compose.yml'),
  'utf-8'
);

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-migrate-'));
  writeFileSync(join(root, 'docker-compose.yml'), 'services: {}\n');
  mkdirSync(join(root, 'servers', 'alpha', 'data', 'world'), { recursive: true });
  writeFileSync(join(root, 'servers', 'alpha', 'config.env'), 'TYPE=PAPER\n');
  // The spec write (#675) needs the server's compose and a runtime that reports it stopped
  writeFileSync(
    join(root, 'servers', 'alpha', 'docker-compose.yml'),
    TEMPLATE_COMPOSE.replace(/mc-template/g, 'mc-alpha').replace('mc-router.host: "template.local"', 'mc-router.host: "alpha.local"')
  );
  const stopped = { getStatus: () => 'exited' } as unknown as IContainerRuntimePort;
  serverSpecRepositories.create = (p) => new FileServerSpecRepository(p, undefined, stopped, () => []);
  writeFileSync(join(root, 'servers', 'alpha', 'data', 'world', 'level.dat'), 'x');
  runtime.getStatusAsync.mockReset();
  runtime.stop.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe('migrate worlds (runtime port)', () => {
  it('stops a running server through the runtime port before moving its world', async () => {
    runtime.getStatusAsync.mockResolvedValue('running');
    let finishStop!: () => void;
    runtime.stop.mockReturnValue(new Promise((resolve) => (finishStop = () => resolve({ success: true }))));

    const migrating = migrateCommand({ root, subCommand: 'worlds', all: true, force: true });
    await vi.waitFor(() => expect(runtime.stop).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    // Not moved while the stop is still running
    expect(existsSync(join(root, 'servers', 'alpha', 'data', 'world', 'level.dat'))).toBe(true);
    finishStop();
    const code = await migrating;

    expect(code).toBe(0);
    const stopped = runtime.stop.mock.calls[0]![0] as ServerName;
    expect(stopped).toBeInstanceOf(ServerName);
    expect(stopped.value).toBe('alpha');
    expect(existsSync(join(root, 'worlds', 'alpha', 'level.dat'))).toBe(true);
  });

  it('does not stop a server that is not running', async () => {
    runtime.getStatusAsync.mockResolvedValue('exited');

    const code = await migrateCommand({ root, subCommand: 'worlds', all: true, force: true });

    expect(code).toBe(0);
    expect(runtime.stop).not.toHaveBeenCalled();
  });

  it('moves the world back and leaves the config as it was when the compose cannot be written', async () => {
    runtime.getStatusAsync.mockResolvedValue('exited');
    const alpha = join(root, 'servers', 'alpha');
    const compose = readFileSync(join(alpha, 'docker-compose.yml'), 'utf-8');
    chmodSync(join(alpha, 'docker-compose.yml'), 0o444);

    const code = await migrateCommand({ root, subCommand: 'worlds', all: true, force: true });

    expect(code).toBe(1);
    expect(existsSync(join(alpha, 'data', 'world', 'level.dat'))).toBe(true);
    expect(existsSync(join(root, 'worlds', 'alpha'))).toBe(false);
    // The next start still finds the world where config.env says it is
    expect(readFileSync(join(alpha, 'config.env'), 'utf-8')).toBe('TYPE=PAPER\n');
    expect(existsSync(join(alpha, 'server.yaml'))).toBe(false);
    expect(readFileSync(join(alpha, 'docker-compose.yml'), 'utf-8')).toBe(compose);
  });

  describe('when the spec write left files it could not put back (unrestoredFiles)', () => {
    const alpha = () => join(root, 'servers', 'alpha');
    const stopped = { getStatus: () => 'exited' } as unknown as IContainerRuntimePort;
    type Write = FileServerSpecRepository['write'];
    /** A repository whose write runs `before`, then fails like a write whose undo was incomplete. */
    function failingWrite(left: string[], before: (write: Write, doc: ServerSpecDocument) => Promise<void>) {
      serverSpecRepositories.create = (p) => {
        const repo = new FileServerSpecRepository(p, undefined, stopped, () => []);
        const write = repo.write.bind(repo);
        repo.write = async (doc) => {
          await before(write, doc);
          throw Object.assign(new Error('ENOSPC: no space left on device'), { unrestoredFiles: left });
        };
        return repo;
      };
    }

    const logged = () => vi.mocked(console.log).mock.calls.map((c) => String(c[0])).join('\n');

    beforeEach(() => runtime.getStatusAsync.mockResolvedValue('exited'));

    it('keeps the world in worlds/ when config.env kept the new LEVEL and --universe', async () => {
      failingWrite(['servers/alpha/config.env'], (write, doc) => write(doc, { allowStorageChange: true }));

      const code = await migrateCommand({ root, subCommand: 'worlds', all: true, force: true });

      expect(code).toBe(1);
      const config = readFileSync(join(alpha(), 'config.env'), 'utf-8');
      expect(config).toMatch(/^LEVEL=alpha$/m);
      expect(config).toMatch(/^EXTRA_ARGS=--universe \/worlds\/$/m);
      // The world is where the config says the server finds it
      expect(existsSync(join(root, 'worlds', 'alpha', 'level.dat'))).toBe(true);
      expect(existsSync(join(alpha(), 'data', 'world'))).toBe(false);
      expect(logged()).toMatch(/world stays in worlds\/alpha.*mcctl migrate spec alpha/);
    });

    it('keeps the world in worlds/ when server.yaml keeps the new spec, though config.env was put back', async () => {
      // alpha already has server.yaml (world in data/) and an mcctl config.env
      const plain = new FileServerSpecRepository(new Paths(root), undefined, stopped, () => []);
      expect(await migrateSpec(plain, { serverName: 'alpha' })).toBe(0);
      const earlierConfig = readFileSync(join(alpha(), 'config.env'), 'utf-8');
      // The repository rule: compose left new, config.env put back, so server.yaml keeps the new spec
      failingWrite(['servers/alpha/docker-compose.yml', 'servers/alpha/server.yaml'], async (write, doc) => {
        await write(doc, { allowStorageChange: true });
        writeFileSync(join(alpha(), 'config.env'), earlierConfig);
      });

      const code = await migrateCommand({ root, subCommand: 'worlds', all: true, force: true });

      expect(code).toBe(1);
      expect(existsSync(join(root, 'worlds', 'alpha', 'level.dat'))).toBe(true);
      expect(logged()).toMatch(/world stays in worlds\/alpha.*run mcctl migrate spec alpha before you start/);

      // The guided command renders config.env from the new spec: it then names the world in worlds/
      expect(await migrateSpec(plain, { serverName: 'alpha' })).toBe(0);
      const config = readFileSync(join(alpha(), 'config.env'), 'utf-8');
      expect(config).toMatch(/^LEVEL=alpha$/m);
      expect(config).toMatch(/^EXTRA_ARGS=--universe \/worlds\/$/m);
    });

    it('says to remove a new server.yaml that mcctl migrate spec would refuse, and a rerun then migrates', async () => {
      // alpha has no server.yaml and a config.env without an mcctl header. The repository rule:
      // config.env put back, compose not, so the new server.yaml (storage: universe) stays.
      failingWrite(['servers/alpha/docker-compose.yml', 'servers/alpha/server.yaml'], async (write, doc) => {
        await write(doc, { allowStorageChange: true });
        writeFileSync(join(alpha(), 'config.env'), 'TYPE=PAPER\n');
      });

      const code = await migrateCommand({ root, subCommand: 'worlds', all: true, force: true });

      expect(code).toBe(1);
      // load() absorbs the earlier config.env: the world goes back where it says
      expect(existsSync(join(alpha(), 'data', 'world', 'level.dat'))).toBe(true);
      expect(existsSync(join(root, 'worlds', 'alpha'))).toBe(false);
      const failure = logged().split('\n').find((l) => l.includes('Migration failed'))!;
      expect(failure).toMatch(/servers\/alpha\/server\.yaml was written by this run and disagrees with servers\/alpha\/config\.env.*remove it, then run mcctl migrate worlds again/);
      expect(failure).not.toContain('mcctl migrate spec');
      // Why: mcctl migrate spec absorbs the same config.env and refuses the storage change
      const plain = new FileServerSpecRepository(new Paths(root), undefined, stopped, () => []);
      expect(await migrateSpec(plain, { serverName: 'alpha' })).toBe(1);

      // As told: remove server.yaml and migrate again
      unlinkSync(join(alpha(), 'server.yaml'));
      serverSpecRepositories.create = () => plain;
      expect(await migrateCommand({ root, subCommand: 'worlds', all: true, force: true })).toBe(0);
      expect(existsSync(join(root, 'worlds', 'alpha', 'level.dat'))).toBe(true);
      const config = readFileSync(join(alpha(), 'config.env'), 'utf-8');
      expect(config).toMatch(/^LEVEL=alpha$/m);
      expect(config).toMatch(/^EXTRA_ARGS=--universe \/worlds\/$/m);
    });

    it('moves the world back when config.env still has the old settings', async () => {
      failingWrite(['servers/alpha/docker-compose.yml'], async () => undefined);

      const code = await migrateCommand({ root, subCommand: 'worlds', all: true, force: true });

      expect(code).toBe(1);
      expect(readFileSync(join(alpha(), 'config.env'), 'utf-8')).toBe('TYPE=PAPER\n');
      expect(existsSync(join(alpha(), 'data', 'world', 'level.dat'))).toBe(true);
      expect(existsSync(join(root, 'worlds', 'alpha'))).toBe(false);
    });

    it('leaves the world where it is and says so when config.env cannot be read', async () => {
      failingWrite(['servers/alpha/config.env'], async () => writeFileSync(join(alpha(), 'config.env'), 'TYPE=PAPER\nLEVEL=${WHERE}\n'));

      const code = await migrateCommand({ root, subCommand: 'worlds', all: true, force: true });

      expect(code).toBe(1);
      expect(existsSync(join(root, 'worlds', 'alpha', 'level.dat'))).toBe(true);
      expect(logged()).toMatch(/left in worlds\/alpha.*LEVEL and EXTRA_ARGS/);
    });
  });

  it('fails without migrating when the stop fails', async () => {
    runtime.getStatusAsync.mockResolvedValue('running');
    runtime.stop.mockResolvedValue({ success: false, error: 'boom' });

    const code = await migrateCommand({ root, subCommand: 'worlds', all: true, force: true });

    expect(code).toBe(1);
    expect(existsSync(join(root, 'servers', 'alpha', 'data', 'world', 'level.dat'))).toBe(true);
  });
});
