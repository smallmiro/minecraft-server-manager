/**
 * FileServerSpecRepository (#675, ADR-0003 §2): servers/<n>/server.yaml
 * read/write, optimistic revision, lazy in-memory import, v2 methods.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { hostname, tmpdir, uptime } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Paths, parseEnvDocument } from '../src/utils/index.js';
import { FileServerSpecRepository, serverSpecTestHooks } from '../src/infrastructure/adapters/server-spec/FileServerSpecRepository.js';
import { ServerSpecError, unrestoredFiles, type ServerSpecDocument } from '../src/domain/server-spec/ServerSpecDocument.js';
import type { IContainerRuntimePort } from '../src/application/ports/outbound/IContainerRuntimePort.js';

// Lets a test fail chosen atomic writes (a restore that fails too); passes through otherwise.
const writeFault = vi.hoisted(() => ({ fail: undefined as ((path: string) => Error | undefined) | undefined }));
vi.mock('../src/utils/atomic-write.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/atomic-write.js')>();
  return {
    ...actual,
    atomicWriteFile: async (...args: Parameters<typeof actual.atomicWriteFile>) => {
      const error = writeFault.fail?.(String(args[0]));
      if (error) throw error;
      return actual.atomicWriteFile(...args);
    },
  };
});

let root: string;
let repo: FileServerSpecRepository;

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const yamlPath = (name: string) => join(root, 'servers', name, 'server.yaml');

function spec(overrides: Partial<ServerSpecDocument> = {}): ServerSpecDocument {
  return {
    specVersion: 1,
    name: 'survival',
    type: 'PAPER',
    version: '1.21',
    memory: '4G',
    image: 'itzg/minecraft-server:java25',
    world: { level: 'survival', storage: 'universe' },
    routing: {
      customHostnames: ['mc.example.com'],
      autoScale: { up: true, down: true },
      asleepMotd: 'zzz\nwake up',
    },
    env: { ENABLE_RCON: 'true', SEED: '12345', MOTD: 'Hi: there #1' },
    ...overrides,
  };
}

function serverDir(name: string, configEnv?: string, compose?: string): string {
  const dir = join(root, 'servers', name);
  mkdirSync(dir, { recursive: true });
  if (configEnv !== undefined) writeFileSync(join(dir, 'config.env'), configEnv);
  if (compose !== undefined) writeFileSync(join(dir, 'docker-compose.yml'), compose);
  return dir;
}

const TEMPLATE_COMPOSE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../cli/templates/servers/_template/docker-compose.yml'),
  'utf-8'
);
/** A server compose as create-server.sh writes it from the bundled template. */
const COMPOSE = (name: string) =>
  TEMPLATE_COMPOSE.replace(/mc-template/g, `mc-${name}`).replace('mc-router.host: "template.local"', `mc-router.host: "${name}.local"`);

const VALID = 'TYPE=PAPER\nEXTRA_ARGS=--universe /worlds/\n';

async function rejection(promise: Promise<unknown>): Promise<ServerSpecError> {
  const error = await promise.then(
    () => {
      throw new Error('expected a rejection');
    },
    (e: unknown) => e
  );
  expect(error).toBeInstanceOf(ServerSpecError);
  return error as ServerSpecError;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-spec-repo-'));
  mkdirSync(join(root, 'servers'));
  // A stopped runtime: these specs set a level the bare config.env lacks (ADR-0003 R4 asks it).
  const stopped = { getStatus: () => 'exited' } as unknown as IContainerRuntimePort;
  repo = new FileServerSpecRepository(new Paths(root), undefined, stopped);
});

afterEach(() => {
  writeFault.fail = undefined;
  rmSync(root, { recursive: true, force: true });
});

describe('write', () => {
  it('writes server.yaml in a fixed key order, quoting what YAML would retype', async () => {
    serverDir('survival', VALID, COMPOSE('survival'));
    await repo.write(spec());

    expect(readFileSync(yamlPath('survival'), 'utf-8')).toBe(
      [
        'specVersion: 1',
        'name: survival',
        'type: PAPER',
        'version: "1.21"',
        'memory: 4G',
        'image: itzg/minecraft-server:java25',
        'world:',
        '  level: survival',
        '  storage: universe',
        'routing:',
        '  customHostnames:',
        '    - mc.example.com',
        '  autoScale:',
        '    up: true',
        '    down: true',
        '  asleepMotd: |-',
        '    zzz',
        '    wake up',
        'env:',
        '  ENABLE_RCON: "true"',
        '  SEED: "12345"',
        '  MOTD: "Hi: there #1"',
        '',
      ].join('\n')
    );
  });

  it('round-trips through load with the revision of the bytes', async () => {
    serverDir('survival', VALID, COMPOSE('survival'));
    await repo.write(spec());
    const loaded = await repo.load('survival');
    expect(loaded).toEqual({
      document: spec(),
      revision: sha(readFileSync(yamlPath('survival'), 'utf-8')),
      warnings: [],
    });
  });

  it("gives a new server.yaml config.env's file mode", async () => {
    serverDir('survival', VALID, COMPOSE('survival'));
    chmodSync(join(root, 'servers', 'survival', 'config.env'), 0o600);
    await repo.write(spec());
    expect(statSync(yamlPath('survival')).mode & 0o777).toBe(0o600);
  });

  it('checks the expected revision', async () => {
    serverDir('survival', VALID, COMPOSE('survival'));
    expect((await rejection(repo.write(spec(), { expectedRevision: 'abc' }))).code).toBe('conflict');
    await repo.write(spec(), { expectedRevision: null });

    const { revision } = (await repo.load('survival'))!;
    expect((await rejection(repo.write(spec({ memory: '6G' }), { expectedRevision: null }))).code).toBe('conflict');
    await repo.write(spec({ memory: '6G' }), { expectedRevision: revision });
    expect((await repo.load('survival'))!.document.memory).toBe('6G');
    expect((await rejection(repo.write(spec(), { expectedRevision: revision }))).code).toBe('conflict');
  });

  it('does not rewrite an unchanged file', async () => {
    serverDir('survival', VALID, COMPOSE('survival'));
    await repo.write(spec());
    const before = statSync(yamlPath('survival')).mtimeMs;
    await new Promise((r) => setTimeout(r, 20));
    await repo.write(spec());
    expect(statSync(yamlPath('survival')).mtimeMs).toBe(before);
  });

  it('refuses an invalid document and writes nothing', async () => {
    serverDir('survival', VALID, COMPOSE('survival'));
    const error = await rejection(repo.write({ ...spec(), env: { LEVEL: 'x' } }));
    expect(error.code).toBe('invalid_spec');
    expect(error.message).toContain('env.LEVEL');
    expect(existsSync(yamlPath('survival'))).toBe(false);
  });

  it('refuses a server whose directory does not exist', async () => {
    expect((await rejection(repo.write(spec()))).code).toBe('not_found');
  });
});

describe('write is all or nothing', () => {
  const file = (...p: string[]) => join(root, 'servers', 'survival', ...p);
  const hooks = { ...serverSpecTestHooks };

  afterEach(() => {
    Object.assign(serverSpecTestHooks, hooks);
  });

  it('leaves the files another writer changed while the include lock was awaited', async () => {
    serverDir('survival', VALID, COMPOSE('survival'));
    // A live process holds servers/compose.yml: our files are written, then the lock is awaited
    const holder = {
      pid: process.pid,
      hostname: hostname(),
      bootTime: Math.round(Date.now() - uptime() * 1000),
      nonce: 'someone-else',
      op: 'compose-include',
      startedAt: new Date().toISOString(),
    };
    writeFileSync(join(root, 'servers', '.compose.yml.lock'), JSON.stringify(holder));
    serverSpecTestHooks.includeLockWaitMs = 400;
    const writing = repo.write(spec()).catch((e: unknown) => e);
    await vi.waitFor(() => expect(readFileSync(file('docker-compose.yml'), 'utf-8')).toMatch(/^# Generated by mcctl/), {
      interval: 10,
    });
    writeFileSync(file('config.env'), 'TYPE=PAPER\nMOTD=admin\n');
    writeFileSync(yamlPath('survival'), '# edited by another writer\n');

    const error = (await writing) as ServerSpecError;

    expect(error.code).toBe('locked');
    expect(readFileSync(file('config.env'), 'utf-8')).toBe('TYPE=PAPER\nMOTD=admin\n');
    // server.yaml was new: another writer changed it since, so it is not removed
    expect(readFileSync(yamlPath('survival'), 'utf-8')).toBe('# edited by another writer\n');
    expect(readFileSync(file('docker-compose.yml'), 'utf-8')).toBe(COMPOSE('survival'));
    expect(error.message).toMatch(/servers\/survival\/server\.yaml.*servers\/survival\/config\.env|config\.env.*server\.yaml/);
    expect(error.message).toContain('changed since this write');
    expect(unrestoredFiles(error).sort()).toEqual(['servers/survival/config.env', 'servers/survival/server.yaml']);
  });

  it('removes the new server.yaml and puts config.env back when the compose cannot be written', async () => {
    serverDir('survival', VALID, COMPOSE('survival'));
    chmodSync(file('docker-compose.yml'), 0o444);

    const error = await repo.write(spec()).catch((e: unknown) => e);

    expect((error as NodeJS.ErrnoException).code).toBe('EACCES');
    expect(unrestoredFiles(error)).toEqual([]);
    expect(existsSync(yamlPath('survival'))).toBe(false);
    expect(readFileSync(file('config.env'), 'utf-8')).toBe(VALID);
    expect(readFileSync(file('docker-compose.yml'), 'utf-8')).toBe(COMPOSE('survival'));
  });

  it('puts server.yaml and config.env back to the previous write', async () => {
    serverDir('survival', VALID, COMPOSE('survival'));
    await repo.write(spec());
    const yamlBefore = readFileSync(yamlPath('survival'), 'utf-8');
    const configBefore = readFileSync(file('config.env'), 'utf-8');
    chmodSync(file('docker-compose.yml'), 0o444);

    await expect(repo.write(spec({ memory: '6G', image: 'itzg/minecraft-server:java21' }))).rejects.toMatchObject({ code: 'EACCES' });

    expect(readFileSync(yamlPath('survival'), 'utf-8')).toBe(yamlBefore);
    expect(readFileSync(file('config.env'), 'utf-8')).toBe(configBefore);
    expect((await repo.load('survival'))!.document).toEqual(spec());
  });

  it('keeps the write error and adds a restore that failed', async () => {
    serverDir('survival', VALID, COMPOSE('survival'));
    let configWrites = 0;
    writeFault.fail = (path) => {
      if (path.endsWith('docker-compose.yml')) return new Error('compose write failed');
      if (path.endsWith('config.env') && ++configWrites > 1) return new Error('disk full');
      return undefined;
    };

    const error = (await repo.write(spec()).catch((e: unknown) => e)) as Error;

    expect(error.message).toMatch(/^compose write failed .*servers\/survival\/config\.env: disk full/);
    // The caller can tell config.env kept the new content (migrate worlds decides on it); the new
    // server.yaml stays too, so the definition matches config.env
    expect(unrestoredFiles(error).sort()).toEqual(['servers/survival/config.env', 'servers/survival/server.yaml']);
    expect((await repo.loadFile('survival'))!.document).toEqual(spec());
  });

  it('keeps the new server.yaml while a generated file keeps the new content, so migrate spec renders the new spec', async () => {
    // An existing server that keeps its world in its data directory
    serverDir('survival', 'TYPE=PAPER\n', COMPOSE('survival'));
    const earlier = spec({ world: { level: 'world', storage: 'data' } });
    await repo.write(earlier);
    const earlierCompose = readFileSync(file('docker-compose.yml'), 'utf-8');
    let configWrites = 0;
    writeFault.fail = (path) => {
      if (path.endsWith('docker-compose.yml')) return new Error('ENOSPC: no space left on device');
      if (path.endsWith('config.env') && ++configWrites > 1) return new Error('ENOSPC: no space left on device');
      return undefined;
    };

    const error = await repo.write(spec(), { allowStorageChange: true }).catch((e: unknown) => e);

    // Mixed state: config.env could not be put back, so server.yaml keeps the new world too
    expect(unrestoredFiles(error).sort()).toEqual(['servers/survival/config.env', 'servers/survival/server.yaml']);
    expect((error as Error).message).toContain('server.yaml');
    expect(readFileSync(file('docker-compose.yml'), 'utf-8')).toBe(earlierCompose);
    expect((await repo.load('survival'))!.document.world).toEqual({ level: 'survival', storage: 'universe' });

    // The cause fixed, mcctl migrate spec (load, write) renders the new spec, not the earlier one
    writeFault.fail = undefined;
    const loaded = (await repo.load('survival'))!;
    await repo.write(loaded.document, { expectedRevision: loaded.revision });
    const config = parseEnvDocument(readFileSync(file('config.env'), 'utf-8')).values;
    expect(config.get('LEVEL')).toBe('survival');
    expect(config.get('EXTRA_ARGS')).toBe('--universe /worlds/');
    expect(readFileSync(file('docker-compose.yml'), 'utf-8')).not.toBe(earlierCompose);
  });
});

describe('first write of an existing server', () => {
  it('keeps the empty VERSION=, MEMORY= and PLAYIT_DOMAIN= lines of config.env', async () => {
    const config = 'TYPE=PAPER\nVERSION=\nMEMORY=\nPLAYIT_DOMAIN=\nLEVEL=survival\nEXTRA_ARGS=--universe /worlds/\nMOTD=hi\n';
    const dir = serverDir('survival', config, COMPOSE('survival'));
    const loaded = (await repo.load('survival'))!;

    await repo.write({ ...loaded.document, env: { ...loaded.document.env, MOTD: 'bye' } }, { expectedRevision: null });

    const written = readFileSync(join(dir, 'config.env'), 'utf-8').replace(/^# Generated by mcctl[^\n]*\n/, '');
    expect(written).toBe(config.replace('MOTD=hi', 'MOTD=bye'));
  });
});

describe('load', () => {
  it('returns null for an unknown or unsafe name', async () => {
    serverDir('nothing');
    expect(await repo.load('missing')).toBeNull();
    expect(await repo.load('nothing')).toBeNull();
    expect(await repo.load('../servers')).toBeNull();
  });

  it('imports in memory when server.yaml is missing and writes nothing', async () => {
    serverDir('lazy', 'TYPE=FABRIC\nLEVEL=lazy\nEXTRA_ARGS=--universe /worlds/\nPVP=false\n', COMPOSE('lazy'));
    const loaded = await repo.load('lazy');
    expect(loaded!.revision).toBeNull();
    expect(loaded!.document).toMatchObject({ name: 'lazy', type: 'FABRIC', env: { PVP: 'false' } });
    expect(existsSync(yamlPath('lazy'))).toBe(false);
  });

  it('passes the HOST_IPS of .env to the import for stale nip.io hosts', async () => {
    writeFileSync(join(root, '.env'), 'HOST_IPS=10.0.0.1, 10.0.0.2\n');
    serverDir(
      'lazy',
      'TYPE=PAPER\nEXTRA_ARGS=\n',
      COMPOSE('lazy').replace('"lazy.local"', '"lazy.local,lazy.10.0.0.2.nip.io,lazy.10.0.0.3.nip.io"')
    );
    const { warnings } = (await repo.load('lazy'))!;
    expect(warnings.join('\n')).toContain('lazy.10.0.0.3.nip.io');
    expect(warnings.join('\n')).not.toContain('lazy.10.0.0.2.nip.io');
  });

  it("rejects 'undetermined' when the import is refused", async () => {
    serverDir('interp', 'TYPE=PAPER\nMEMORY=${MEM}\n', COMPOSE('interp'));
    const error = await rejection(repo.load('interp'));
    expect(error.code).toBe('undetermined');
    expect(error.server).toBe('interp');
    expect(error.message).toContain('MEMORY');
  });

  it('rejects a server.yaml that does not parse, retypes a value or names another server', async () => {
    serverDir('a', VALID, COMPOSE('a'));
    writeFileSync(yamlPath('a'), 'specVersion: 1\nname: [\n');
    expect((await rejection(repo.load('a'))).code).toBe('invalid_spec');

    serverDir('b', VALID, COMPOSE('b'));
    await repo.write(spec({ name: 'b' }));
    writeFileSync(yamlPath('b'), readFileSync(yamlPath('b'), 'utf-8').replace('version: "1.21"', 'version: 1.21'));
    const retyped = await rejection(repo.load('b'));
    expect(retyped.code).toBe('invalid_spec');
    expect(retyped.message).toMatch(/version.*quote/);

    serverDir('c', VALID, COMPOSE('c'));
    writeFileSync(yamlPath('c'), readFileSync(yamlPath('b'), 'utf-8').replace('version: 1.21', 'version: "1.21"'));
    expect((await rejection(repo.load('c'))).message).toMatch(/name/);
  });

  it("rejects 'unsupported_spec_version' for a newer file", async () => {
    serverDir('survival', VALID, COMPOSE('survival'));
    await repo.write(spec());
    writeFileSync(yamlPath('survival'), readFileSync(yamlPath('survival'), 'utf-8').replace('specVersion: 1', 'specVersion: 2'));
    expect((await rejection(repo.load('survival'))).code).toBe('unsupported_spec_version');
  });
});

describe('v2 methods', () => {
  it('list returns { name } per directory with server.yaml or config.env, sorted', async () => {
    serverDir('b', VALID, COMPOSE('b'));
    serverDir('a');
    writeFileSync(yamlPath('a'), 'specVersion: 1\n');
    serverDir('_template', VALID, COMPOSE('_template'));
    serverDir('empty');
    writeFileSync(join(root, 'servers', 'compose.yml'), 'include: []\n');
    expect(await repo.list()).toEqual([{ name: 'a' }, { name: 'b' }]);
  });

  it('list is empty without servers/', async () => {
    rmSync(join(root, 'servers'), { recursive: true });
    expect(await repo.list()).toEqual([]);
  });

  it('get returns the document or null', async () => {
    serverDir('survival', VALID, COMPOSE('survival'));
    await repo.write(spec());
    expect(await repo.get('survival')).toEqual(spec());
    expect(await repo.get('missing')).toBeNull();
  });

  it('save writes a full document and rejects a bare { name } listing the missing fields', async () => {
    serverDir('survival', VALID, COMPOSE('survival'));
    const error = await rejection(repo.save({ name: 'survival' }));
    expect(error.code).toBe('invalid_spec');
    expect(error.issues.map((i) => i.path)).toEqual(['specVersion', 'type', 'image', 'world', 'routing', 'env']);

    await repo.save(spec());
    expect((await repo.load('survival'))!.document).toEqual(spec());
  });

  it('delete says it arrives with #735', async () => {
    serverDir('survival', VALID, COMPOSE('survival'));
    await expect(repo.delete('survival')).rejects.toThrow(/#735/);
    expect(existsSync(join(root, 'servers', 'survival'))).toBe(true);
  });
});
