/**
 * `mcctl migrate worlds` checks running servers and removes their containers
 * through the runtime port (#668, ADR-0001 row 14), and moves the world the
 * server really uses (#655).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chmodSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, rmSync, unlinkSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ConfigEnvWorldAssignmentAdapter,
  FileServerSpecRepository,
  Paths,
  ServerName,
  WorldRepository,
  type IContainerRuntimePort,
  type ServerSpecDocument,
} from '@minecraft-docker/shared';

const runtime = {
  getStatusAsync: vi.fn(),
  stop: vi.fn(),
  remove: vi.fn(),
};
let root = '';

vi.mock('../../../src/infrastructure/index.js', () => ({
  getContainer: () => ({
    containerRuntime: runtime,
    promptPort: { isCancel: () => false, confirm: vi.fn(), select: vi.fn() },
    worldAssignmentPort: new ConfigEnvWorldAssignmentAdapter(new Paths(root)),
    worldRepository: new WorldRepository(new Paths(root), undefined, runtime as unknown as IContainerRuntimePort),
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
  runtime.remove.mockReset();
  runtime.remove.mockResolvedValue({ success: true });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

const logged = () => vi.mocked(console.log).mock.calls.map((c) => String(c[0])).join('\n');

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe('migrate worlds (runtime port)', () => {
  it('removes a running server\'s container through the runtime port before moving its world', async () => {
    runtime.getStatusAsync.mockResolvedValue('running');
    let finishRemove!: () => void;
    runtime.remove.mockReturnValue(new Promise((resolve) => (finishRemove = () => resolve({ success: true }))));

    const migrating = migrateCommand({ root, subCommand: 'worlds', all: true, force: true });
    await vi.waitFor(() => expect(runtime.remove).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    // Not moved while the removal is still running
    expect(existsSync(join(root, 'servers', 'alpha', 'data', 'world', 'level.dat'))).toBe(true);
    finishRemove();
    const code = await migrating;

    expect(code).toBe(0);
    const removed = runtime.remove.mock.calls[0]![0] as ServerName;
    expect(removed).toBeInstanceOf(ServerName);
    expect(removed.value).toBe('alpha');
    expect(existsSync(join(root, 'worlds', 'alpha', 'level.dat'))).toBe(true);
  });

  it('removes the container of a stopped server too, so mc-router cannot start it during the move (#655)', async () => {
    runtime.getStatusAsync.mockResolvedValue('exited');

    const code = await migrateCommand({ root, subCommand: 'worlds', all: true, force: true });

    expect(code).toBe(0);
    expect(runtime.remove).toHaveBeenCalledTimes(1);
    expect(runtime.stop).not.toHaveBeenCalled();
    expect(logged()).toContain('mcctl start alpha');
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

  it('fails without migrating when the runtime cannot remove the container', async () => {
    runtime.getStatusAsync.mockResolvedValue('not_found');
    runtime.remove.mockResolvedValue({ success: false, error: 'Cannot list Docker containers (is Docker running?)' });

    const code = await migrateCommand({ root, subCommand: 'worlds', all: true, force: true });

    expect(code).toBe(1);
    expect(existsSync(join(root, 'servers', 'alpha', 'data', 'world', 'level.dat'))).toBe(true);
    expect(existsSync(join(root, 'worlds', 'alpha'))).toBe(false);
    expect(readFileSync(join(root, 'servers', 'alpha', 'config.env'), 'utf-8')).toBe('TYPE=PAPER\n');
    expect(logged()).toContain('is Docker running?');
  });
});

describe('migrate worlds finds the world by LEVEL (#655)', () => {
  const alpha = () => join(root, 'servers', 'alpha');
  const data = (...p: string[]) => join(alpha(), 'data', ...p);
  const worlds = (...p: string[]) => join(root, 'worlds', ...p);
  const config = () => readFileSync(join(alpha(), 'config.env'), 'utf-8');
  /** alpha with `configEnv` and these folders in data/ (each with a file in it). */
  function alphaWith(configEnv: string, folders: string[]): void {
    writeFileSync(join(alpha(), 'config.env'), configEnv);
    rmSync(data(), { recursive: true, force: true });
    for (const f of folders) {
      mkdirSync(data(f), { recursive: true });
      writeFileSync(data(f, f.endsWith('_nether') || f.endsWith('_the_end') ? 'region.mca' : 'level.dat'), f);
    }
  }
  const migrate = (extra: Record<string, unknown> = {}) =>
    migrateCommand({ root, subCommand: 'worlds', serverName: 'alpha', force: true, ...extra });

  beforeEach(() => runtime.getStatusAsync.mockResolvedValue('exited'));

  it('moves data/<LEVEL>, not data/world, and keeps LEVEL', async () => {
    alphaWith('TYPE=PAPER\nLEVEL=alpha\n', ['alpha', 'world']);

    expect(await migrate()).toBe(0);

    expect(readFileSync(worlds('alpha', 'level.dat'), 'utf-8')).toBe('alpha');
    expect(existsSync(data('alpha'))).toBe(false);
    expect(config()).toMatch(/^LEVEL=alpha$/m);
    expect(config()).toMatch(/^EXTRA_ARGS=--universe \/worlds\/$/m);
  });

  it('moves the split dimension folders of Paper/Spigot with it', async () => {
    alphaWith('TYPE=PAPER\nLEVEL=survival\n', ['survival', 'survival_nether', 'survival_the_end']);

    expect(await migrate()).toBe(0);

    expect(readFileSync(worlds('survival_nether', 'region.mca'), 'utf-8')).toBe('survival_nether');
    expect(readFileSync(worlds('survival_the_end', 'region.mca'), 'utf-8')).toBe('survival_the_end');
    expect(config()).toMatch(/^LEVEL=survival$/m);
  });

  it('names the dimension folders after the final LEVEL when the default world is renamed', async () => {
    alphaWith('TYPE=PAPER\n', ['world', 'world_nether', 'world_the_end']);

    expect(await migrate()).toBe(0);

    expect(config()).toMatch(/^LEVEL=alpha$/m);
    expect(readFileSync(worlds('alpha', 'level.dat'), 'utf-8')).toBe('world');
    expect(readFileSync(worlds('alpha_nether', 'region.mca'), 'utf-8')).toBe('world_nether');
    expect(readFileSync(worlds('alpha_the_end', 'region.mca'), 'utf-8')).toBe('world_the_end');
  });

  it('keeps the dimensions of a vanilla world inside its folder', async () => {
    alphaWith('TYPE=VANILLA\nLEVEL=alpha\n', ['alpha']);
    mkdirSync(data('alpha', 'DIM-1'));
    mkdirSync(data('alpha', 'DIM1'));

    expect(await migrate()).toBe(0);

    expect(existsSync(worlds('alpha', 'DIM-1'))).toBe(true);
    expect(existsSync(worlds('alpha', 'DIM1'))).toBe(true);
  });

  it('changes only the config of a server that has not created a world yet', async () => {
    alphaWith('TYPE=PAPER\nLEVEL=alpha\n', []);

    expect(await migrate()).toBe(0);

    expect(config()).toMatch(/^EXTRA_ARGS=--universe \/worlds\/$/m);
    expect(existsSync(worlds('alpha'))).toBe(false);
  });

  it('moves a copy an earlier migrate left in data/ to where the server already looks', async () => {
    alphaWith('TYPE=PAPER\nLEVEL=alpha\nEXTRA_ARGS=--universe /worlds/\n', ['alpha']);

    expect(await migrate()).toBe(0);

    expect(readFileSync(worlds('alpha', 'level.dat'), 'utf-8')).toBe('alpha');
    expect(config()).toMatch(/^LEVEL=alpha$/m);
  });

  describe('changes nothing and stops', () => {
    function expectUnchanged(configEnv: string, folders: string[]): void {
      expect(config()).toBe(configEnv);
      for (const f of folders) expect(existsSync(data(f))).toBe(true);
      expect(existsSync(join(alpha(), 'server.yaml'))).toBe(false);
      expect(runtime.remove).not.toHaveBeenCalled();
    }

    it('when data/<LEVEL> is missing but data/ holds another world', async () => {
      alphaWith('TYPE=PAPER\nLEVEL=alpha\n', ['world']);

      expect(await migrate()).toBe(1);

      expectUnchanged('TYPE=PAPER\nLEVEL=alpha\n', ['world']);
      expect(logged()).toMatch(/servers\/alpha\/data\/alpha.*world/);
    });

    it('when data/<LEVEL> is a symbolic link', async () => {
      alphaWith('TYPE=PAPER\nLEVEL=alpha\n', []);
      mkdirSync(join(root, 'elsewhere'));
      writeFileSync(join(root, 'elsewhere', 'level.dat'), 'x');
      mkdirSync(data(), { recursive: true });
      symlinkSync(join(root, 'elsewhere'), data('alpha'));

      expect(await migrate()).toBe(1);

      expect(config()).toBe('TYPE=PAPER\nLEVEL=alpha\n');
      expect(runtime.remove).not.toHaveBeenCalled();
      expect(logged()).toMatch(/symbolic link/);
    });

    it.each(['alpha', 'alpha_nether', 'alpha_the_end'])('when worlds/%s already exists', async (taken) => {
      alphaWith('TYPE=PAPER\nLEVEL=alpha\n', ['alpha', 'alpha_nether']);
      mkdirSync(worlds(taken), { recursive: true });

      expect(await migrate()).toBe(1);

      expectUnchanged('TYPE=PAPER\nLEVEL=alpha\n', ['alpha', 'alpha_nether']);
      expect(readdirSync(worlds())).toEqual([taken]);
      expect(logged()).toContain(`worlds/${taken} already exists`);
    });

    it('when a server already started on an empty worlds/<LEVEL> after an earlier migrate', async () => {
      const configEnv = 'TYPE=PAPER\nLEVEL=alpha\nEXTRA_ARGS=--universe /worlds/\n';
      alphaWith(configEnv, ['alpha']);
      mkdirSync(worlds('alpha'), { recursive: true });

      expect(await migrate()).toBe(1);

      expectUnchanged(configEnv, ['alpha']);
    });

    it('when EXTRA_ARGS would still keep the world in data/', async () => {
      const configEnv = 'TYPE=PAPER\nLEVEL=alpha\nEXTRA_ARGS=--universe /data\n';
      alphaWith(configEnv, ['alpha']);

      expect(await migrate()).toBe(1);

      expectUnchanged(configEnv, ['alpha']);
      expect(existsSync(worlds('alpha'))).toBe(false);
    });
  });

  it('keeps --backup copies outside data/', async () => {
    alphaWith('TYPE=PAPER\nLEVEL=alpha\n', ['alpha', 'alpha_nether']);

    expect(await migrate({ backup: true })).toBe(0);

    expect(existsSync(data())).toBe(true);
    expect(readdirSync(data())).toEqual([]);
    const [backup, ...more] = readdirSync(join(root, 'backups', 'migrate'));
    expect(more).toEqual([]);
    expect(backup).toMatch(/^alpha-/);
    expect(readFileSync(join(root, 'backups', 'migrate', backup!, 'alpha', 'level.dat'), 'utf-8')).toBe('alpha');
    expect(existsSync(join(root, 'backups', 'migrate', backup!, 'alpha_nether', 'region.mca'))).toBe(true);
  });

  describe('--dry-run', () => {
    it('shows the real moves and the final LEVEL, and changes nothing', async () => {
      alphaWith('TYPE=PAPER\n', ['world', 'world_nether']);

      expect(await migrate({ dryRun: true })).toBe(0);

      const text = logged();
      expect(text).toContain(`${data('world')} → ${worlds('alpha')}`);
      expect(text).toContain(`${data('world_nether')} → ${worlds('alpha_nether')}`);
      expect(text).toContain('LEVEL=alpha');
      expect(text).toContain('Remove container mc-alpha');
      expect(existsSync(data('world', 'level.dat'))).toBe(true);
      expect(config()).toBe('TYPE=PAPER\n');
      expect(runtime.remove).not.toHaveBeenCalled();
      expect(runtime.getStatusAsync).not.toHaveBeenCalled();
    });

    it('shows why a server would not be migrated and fails', async () => {
      alphaWith('TYPE=PAPER\nLEVEL=alpha\n', ['alpha']);
      mkdirSync(worlds('alpha'), { recursive: true });

      expect(await migrate({ dryRun: true })).toBe(1);

      expect(logged()).toContain('worlds/alpha already exists');
    });
  });

  it('migrate status reports the world by LEVEL', async () => {
    alphaWith('TYPE=PAPER\nLEVEL=alpha\nEXTRA_ARGS=--universe /worlds/\n', ['alpha']);

    expect(await migrateCommand({ root, subCommand: 'status', json: true })).toBe(0);

    const report = JSON.parse(logged()) as { servers: Array<{ name: string; needsMigration: boolean; currentWorldPath?: string }> };
    expect(report.servers).toEqual([
      expect.objectContaining({ name: 'alpha', needsMigration: true, currentWorldPath: data('alpha') }),
    ]);
  });
});
