/**
 * FileServerSpecRepository (#675, ADR-0003 §2): servers/<n>/server.yaml
 * read/write, optimistic revision, lazy in-memory import, v2 methods.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Paths } from '../src/utils/index.js';
import { FileServerSpecRepository } from '../src/infrastructure/adapters/server-spec/FileServerSpecRepository.js';
import { ServerSpecError, type ServerSpecDocument } from '../src/domain/server-spec/ServerSpecDocument.js';

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

const COMPOSE = (name: string, image = 'itzg/minecraft-server:java25') =>
  `services:\n  mc-${name}:\n    image: ${image}\n    labels:\n      mc-router.host: "${name}.local"\n      mc-router.auto-scale-up: "true"\n      mc-router.auto-scale-down: "true"\n`;

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
  repo = new FileServerSpecRepository(new Paths(root));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('write', () => {
  it('writes server.yaml in a fixed key order, quoting what YAML would retype', async () => {
    serverDir('survival', 'TYPE=PAPER\n');
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
    serverDir('survival', 'TYPE=PAPER\n');
    await repo.write(spec());
    const loaded = await repo.load('survival');
    expect(loaded).toEqual({
      document: spec(),
      revision: sha(readFileSync(yamlPath('survival'), 'utf-8')),
      warnings: [],
    });
  });

  it("gives a new server.yaml config.env's file mode", async () => {
    serverDir('survival', 'TYPE=PAPER\n');
    chmodSync(join(root, 'servers', 'survival', 'config.env'), 0o600);
    await repo.write(spec());
    expect(statSync(yamlPath('survival')).mode & 0o777).toBe(0o600);
  });

  it('checks the expected revision', async () => {
    serverDir('survival', 'TYPE=PAPER\n');
    expect((await rejection(repo.write(spec(), { expectedRevision: 'abc' }))).code).toBe('conflict');
    await repo.write(spec(), { expectedRevision: null });

    const { revision } = (await repo.load('survival'))!;
    expect((await rejection(repo.write(spec({ memory: '6G' }), { expectedRevision: null }))).code).toBe('conflict');
    await repo.write(spec({ memory: '6G' }), { expectedRevision: revision });
    expect((await repo.load('survival'))!.document.memory).toBe('6G');
    expect((await rejection(repo.write(spec(), { expectedRevision: revision }))).code).toBe('conflict');
  });

  it('does not rewrite an unchanged file', async () => {
    serverDir('survival', 'TYPE=PAPER\n');
    await repo.write(spec());
    const before = statSync(yamlPath('survival')).mtimeMs;
    await new Promise((r) => setTimeout(r, 20));
    await repo.write(spec());
    expect(statSync(yamlPath('survival')).mtimeMs).toBe(before);
  });

  it('refuses an invalid document and writes nothing', async () => {
    serverDir('survival', 'TYPE=PAPER\n');
    const error = await rejection(repo.write({ ...spec(), env: { LEVEL: 'x' } }));
    expect(error.code).toBe('invalid_spec');
    expect(error.message).toContain('env.LEVEL');
    expect(existsSync(yamlPath('survival'))).toBe(false);
  });

  it('refuses a server whose directory does not exist', async () => {
    expect((await rejection(repo.write(spec()))).code).toBe('not_found');
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
    serverDir('a', 'TYPE=PAPER\n');
    writeFileSync(yamlPath('a'), 'specVersion: 1\nname: [\n');
    expect((await rejection(repo.load('a'))).code).toBe('invalid_spec');

    serverDir('b', 'TYPE=PAPER\n');
    await repo.write(spec({ name: 'b' }));
    writeFileSync(yamlPath('b'), readFileSync(yamlPath('b'), 'utf-8').replace('version: "1.21"', 'version: 1.21'));
    const retyped = await rejection(repo.load('b'));
    expect(retyped.code).toBe('invalid_spec');
    expect(retyped.message).toMatch(/version.*quote/);

    serverDir('c', 'TYPE=PAPER\n');
    writeFileSync(yamlPath('c'), readFileSync(yamlPath('b'), 'utf-8').replace('version: 1.21', 'version: "1.21"'));
    expect((await rejection(repo.load('c'))).message).toMatch(/name/);
  });

  it("rejects 'unsupported_spec_version' for a newer file", async () => {
    serverDir('survival', 'TYPE=PAPER\n');
    await repo.write(spec());
    writeFileSync(yamlPath('survival'), readFileSync(yamlPath('survival'), 'utf-8').replace('specVersion: 1', 'specVersion: 2'));
    expect((await rejection(repo.load('survival'))).code).toBe('unsupported_spec_version');
  });
});

describe('v2 methods', () => {
  it('list returns { name } per directory with server.yaml or config.env, sorted', async () => {
    serverDir('b', 'TYPE=PAPER\n');
    serverDir('a');
    writeFileSync(yamlPath('a'), 'specVersion: 1\n');
    serverDir('_template', 'TYPE=PAPER\n');
    serverDir('empty');
    writeFileSync(join(root, 'servers', 'compose.yml'), 'include: []\n');
    expect(await repo.list()).toEqual([{ name: 'a' }, { name: 'b' }]);
  });

  it('list is empty without servers/', async () => {
    rmSync(join(root, 'servers'), { recursive: true });
    expect(await repo.list()).toEqual([]);
  });

  it('get returns the document or null', async () => {
    serverDir('survival', 'TYPE=PAPER\n');
    await repo.write(spec());
    expect(await repo.get('survival')).toEqual(spec());
    expect(await repo.get('missing')).toBeNull();
  });

  it('save writes a full document and rejects a bare { name } listing the missing fields', async () => {
    serverDir('survival', 'TYPE=PAPER\n');
    const error = await rejection(repo.save({ name: 'survival' }));
    expect(error.code).toBe('invalid_spec');
    expect(error.issues.map((i) => i.path)).toEqual(['specVersion', 'type', 'image', 'world', 'routing', 'env']);

    await repo.save(spec());
    expect((await repo.load('survival'))!.document).toEqual(spec());
  });

  it('delete says it arrives with #735', async () => {
    serverDir('survival', 'TYPE=PAPER\n');
    await expect(repo.delete('survival')).rejects.toThrow(/#735/);
    expect(existsSync(join(root, 'servers', 'survival'))).toBe(true);
  });
});
