/**
 * Import of an existing server into a ServerSpecDocument (#675, ADR-0003 §4),
 * on temp roots built from the bundled template the way create-server.sh does.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Paths } from '../src/utils/index.js';
import { importDockerServer } from '../src/infrastructure/adapters/server-spec/importDockerServer.js';

const TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), '../../cli/templates/servers/_template');
const IP = '192.168.1.10';

let root: string;
let paths: Paths;

/** A server as create-server.sh writes it: sed on the bundled template. */
function templateServer(name: string, opts: { hosts?: string[]; config?: (c: string) => string; compose?: (c: string) => string } = {}) {
  const dir = join(root, 'servers', name);
  mkdirSync(dir, { recursive: true });
  const hosts = opts.hosts ?? [`${name}.local`, `${name}.${IP}.nip.io`];
  let compose = readFileSync(join(TEMPLATE, 'docker-compose.yml'), 'utf-8')
    .replace(/mc-template/g, `mc-${name}`)
    .replace('template.local', hosts.join(','));
  let config = readFileSync(join(TEMPLATE, 'config.env'), 'utf-8')
    .replace(/^LEVEL=.*$/m, `LEVEL=${name}`)
    .replace(/^MOTD=.*$/m, `MOTD=Welcome to ${name}! Your adventure begins here.`);
  if (opts.compose) compose = opts.compose(compose);
  if (opts.config) config = opts.config(config);
  writeFileSync(join(dir, 'docker-compose.yml'), compose);
  writeFileSync(join(dir, 'config.env'), config);
}

const setLine = (key: string, line: string) => (c: string) => c.replace(new RegExp(`^${key}=.*$`, 'm'), line);
const imp = (name: string, hostIps: string[] = [IP]) => importDockerServer(name, { paths, hostIps });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-spec-import-'));
  paths = new Paths(root);
  mkdirSync(join(root, 'servers'), { recursive: true });
  writeFileSync(join(root, 'servers', 'global.env'), 'TZ\nEXTRA_ARGS\nRCON_PASSWORD\n');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('importDockerServer: a template-created server', () => {
  it('maps config.env and compose to the typed fields and keeps the rest in env, in file order', async () => {
    templateServer('survival');
    mkdirSync(join(root, 'worlds', 'survival'), { recursive: true });

    const result = await imp('survival');

    expect(result.status).toBe('imported');
    expect(result.warnings).toEqual([]);
    expect(result.document).toEqual({
      specVersion: 1,
      name: 'survival',
      type: 'PAPER',
      version: '1.20.4',
      memory: '4G',
      image: 'itzg/minecraft-server:java25',
      world: { level: 'survival', storage: 'universe' },
      routing: {
        customHostnames: [],
        autoScale: { up: true, down: true },
        asleepMotd: '§e§lServer is sleeping§r\n§7Connect to wake up!',
        loadingMotd: '§a§lServer is starting...§r\n§7Please wait!',
      },
      env: {
        GAMEMODE: 'survival',
        DIFFICULTY: 'normal',
        MAX_PLAYERS: '20',
        VIEW_DISTANCE: '10',
        PVP: 'true',
        SPAWN_PROTECTION: '0',
        ENABLE_RCON: 'true',
        MOTD: 'Welcome to survival! Your adventure begins here.',
        MODRINTH_DOWNLOAD_DEPENDENCIES: 'required',
      },
    });
    expect(Object.keys(result.document!.env)).toEqual([
      'GAMEMODE', 'DIFFICULTY', 'MAX_PLAYERS', 'VIEW_DISTANCE', 'PVP', 'SPAWN_PROTECTION', 'ENABLE_RCON', 'MOTD',
      'MODRINTH_DOWNLOAD_DEPENDENCIES',
    ]);
  });

  it('refuses a server without config.env or docker-compose.yml', async () => {
    mkdirSync(join(root, 'servers', 'empty'));
    expect(await imp('empty')).toMatchObject({ status: 'refused', reason: expect.stringMatching(/config\.env/) });

    templateServer('nocompose');
    rmSync(join(root, 'servers', 'nocompose', 'docker-compose.yml'));
    expect(await imp('nocompose')).toMatchObject({ status: 'refused', reason: expect.stringMatching(/docker-compose\.yml/) });
  });
});

describe('importDockerServer: config.env parsing', () => {
  it('reads quoted, commented and duplicate keys like Compose', async () => {
    templateServer('q', {
      config: (c) =>
        setLine('MOTD', 'MOTD="Hello world" # greeting')(c) + "SEED='123'\nMEMORY=6G\n# MEMORY=8G\n",
    });
    const { document } = await imp('q');
    expect(document!.memory).toBe('6G');
    expect(document!.env['MOTD']).toBe('Hello world');
    expect(document!.env['SEED']).toBe('123');
  });

  it('takes the legacy WORLD_NAME as the level and keeps it in env', async () => {
    templateServer('legacy', { config: (c) => c.replace(/^LEVEL=.*\n/m, '') + 'WORLD_NAME=old\n' });
    const { document } = await imp('legacy');
    expect(document!.world.level).toBe('old');
    expect(document!.env['WORLD_NAME']).toBe('old');
  });

  it("falls back to itzg's default world", async () => {
    templateServer('plain', { config: (c) => c.replace(/^LEVEL=.*\n/m, '') });
    expect((await imp('plain')).document!.world.level).toBe('world');
  });

  it('treats empty typed values as absent and defaults a missing TYPE to VANILLA with a warning', async () => {
    templateServer('e', { config: (c) => setLine('VERSION', 'VERSION=')(c).replace(/^TYPE=.*\n/m, '') });
    const result = await imp('e');
    expect(result.document!.version).toBeUndefined();
    expect(result.document!.type).toBe('VANILLA');
    expect(result.warnings.join('\n')).toMatch(/TYPE/);
  });

  it('keeps unknown keys and literal ${...} in non-managed keys', async () => {
    templateServer('u', { config: (c) => c + 'CUSTOM_THING=yes\nMOTD2=Hi ${USER}\n' });
    const { document } = await imp('u');
    expect(document!.env['CUSTOM_THING']).toBe('yes');
    expect(document!.env['MOTD2']).toBe('Hi ${USER}');
  });

  it('refuses a value the env rule rejects, naming the key', async () => {
    templateServer('bad', { config: setLine('MOTD', `MOTD='"quoted'`) });
    expect(await imp('bad')).toMatchObject({ status: 'refused', reason: expect.stringContaining('env.MOTD') });
  });

  it('reports values the strict create rules would reject but imports them', async () => {
    templateServer('Old_Server', { config: setLine('TYPE', 'TYPE=CUSTOM_LOADER') });
    const result = await imp('Old_Server');
    expect(result.status).toBe('imported');
    expect(result.document!.type).toBe('CUSTOM_LOADER');
    const text = result.warnings.join('\n');
    expect(text).toMatch(/name/);
    expect(text).toMatch(/type/);
  });
});

describe('importDockerServer: world storage (ADR-0002 resolution)', () => {
  it.each([
    ['EXTRA_ARGS=--universe /worlds/', 'universe', undefined],
    ['EXTRA_ARGS=--universe=/worlds', 'universe', undefined],
    ['EXTRA_ARGS=-Dfoo=1 --universe /worlds/ -Dbar=2', 'universe', '-Dfoo=1 -Dbar=2'],
    ['EXTRA_ARGS=--universe /data', 'data', undefined],
    ['EXTRA_ARGS=--universe .', 'data', undefined],
    ['EXTRA_ARGS=-Dfoo=1', 'data', '-Dfoo=1'],
    ['EXTRA_ARGS=', 'data', undefined],
  ])('%s → %s', async (line, storage, rest) => {
    writeFileSync(join(root, 'servers', 'global.env'), 'EXTRA_ARGS=--universe /worlds/\n');
    templateServer('s', { config: setLine('EXTRA_ARGS', line) });
    const result = await imp('s');
    expect(result.document!.world.storage).toBe(storage);
    expect(result.document!.env['EXTRA_ARGS']).toBe(rest);
    expect(result.warnings.join('\n')).not.toMatch(/pin/i);
  });

  it('pins EXTRA_ARGS inherited from global.env and reports it', async () => {
    writeFileSync(join(root, 'servers', 'global.env'), 'EXTRA_ARGS=--universe /worlds/ -Dx=1\n');
    templateServer('s', { config: (c) => c.replace(/^EXTRA_ARGS=.*\n/m, '') });
    const result = await imp('s');
    expect(result.document!.world.storage).toBe('universe');
    expect(result.document!.env['EXTRA_ARGS']).toBe('-Dx=1');
    expect(result.warnings.join('\n')).toMatch(/EXTRA_ARGS.*pin/i);
  });

  it('follows a bare global.env key to the platform .env', async () => {
    writeFileSync(join(root, '.env'), "EXTRA_ARGS='--universe /worlds/'\n");
    templateServer('s', { config: (c) => c.replace(/^EXTRA_ARGS=.*\n/m, '') });
    const result = await imp('s');
    expect(result.document!.world.storage).toBe('universe');
    expect(result.warnings.join('\n')).toMatch(/pin/i);
  });

  it('treats an unset inherited value as data and still pins it', async () => {
    templateServer('s', { config: (c) => c.replace(/^EXTRA_ARGS=.*\n/m, '') });
    const result = await imp('s');
    expect(result.document!.world.storage).toBe('data');
    expect(result.warnings.join('\n')).toMatch(/pin/i);
  });

  it('refuses another --universe location', async () => {
    templateServer('s', { config: setLine('EXTRA_ARGS', 'EXTRA_ARGS=--universe /srv/worlds') });
    expect(await imp('s')).toMatchObject({ status: 'refused', reason: expect.stringMatching(/--universe/) });
  });

  it('warns when the universe world is missing but the server keeps one in data/', async () => {
    templateServer('s');
    mkdirSync(join(root, 'servers', 's', 'data', 's'), { recursive: true });
    expect((await imp('s')).warnings.join('\n')).toMatch(/worlds\/s.*data\/s|data\/s.*worlds\/s/);
  });
});

describe('importDockerServer: interpolation fails closed (R7)', () => {
  it.each([
    ['MEMORY', 'MEMORY=${MEM}'],
    ['LEVEL', 'LEVEL="${WORLD}"'],
    ['EXTRA_ARGS', 'EXTRA_ARGS=${ARGS}'],
  ])('refuses an interpolated %s in config.env', async (key, line) => {
    templateServer('s', { config: setLine(key, line) });
    expect(await imp('s')).toMatchObject({ status: 'refused', reason: expect.stringContaining(key) });
  });

  it('refuses an interpolated TYPE, VERSION or PLAYIT_DOMAIN', async () => {
    templateServer('t', { config: setLine('TYPE', 'TYPE=${T}') });
    templateServer('v', { config: setLine('VERSION', 'VERSION=$V') });
    templateServer('p', { config: (c) => c + 'PLAYIT_DOMAIN=${D}\n' });
    for (const s of ['t', 'v', 'p']) expect((await imp(s)).status).toBe('refused');
  });

  it('reads a single-quoted $ literally', async () => {
    templateServer('s', { config: setLine('VERSION', "VERSION='1.21$'") });
    expect((await imp('s')).status).toBe('imported');
  });

  it('refuses an interpolated inherited EXTRA_ARGS', async () => {
    writeFileSync(join(root, '.env'), 'EXTRA_ARGS=${HOME}\n');
    templateServer('s', { config: (c) => c.replace(/^EXTRA_ARGS=.*\n/m, '') });
    expect(await imp('s')).toMatchObject({ status: 'refused', reason: expect.stringMatching(/EXTRA_ARGS/) });
  });
});

describe('importDockerServer: compose', () => {
  it('classifies system and custom router hosts and lowercases custom ones', async () => {
    templateServer('s', {
      hosts: ['s.local', `s.${IP}.nip.io`, 'aa.example.com', 'MC.Example.com', 'other.local'],
      config: (c) => c + 'PLAYIT_DOMAIN=aa.example.com\n',
    });
    const { document, warnings } = await imp('s');
    expect(document!.routing.playitDomain).toBe('aa.example.com');
    expect(document!.routing.customHostnames).toEqual(['mc.example.com', 'other.local']);
    expect(warnings).toEqual([]);
  });

  it('reports nip.io hosts for an address no longer in HOST_IPS', async () => {
    templateServer('s', { hosts: ['s.local', 's.10.0.0.9.nip.io'] });
    const { document, warnings } = await imp('s');
    expect(document!.routing.customHostnames).toEqual([]);
    expect(warnings.join('\n')).toMatch(/s\.10\.0\.0\.9\.nip\.io/);
  });

  it('absorbs a hand-edited image and router labels', async () => {
    templateServer('s', {
      compose: (c) =>
        c
          .replace('itzg/minecraft-server:java25', 'itzg/minecraft-server:java21')
          .replace('mc-router.auto-scale-down: "true"', 'mc-router.auto-scale-down: false')
          .replace(/^\s*mc-router\.auto-scale-loading-motd:.*\n/m, ''),
    });
    const { document } = await imp('s');
    expect(document!.image).toBe('itzg/minecraft-server:java21');
    expect(document!.routing.autoScale).toEqual({ up: true, down: false });
    expect(document!.routing.loadingMotd).toBeUndefined();
  });

  it('accepts list-form labels and environment', async () => {
    templateServer('s', {
      compose: (c) =>
        c
          .replace('environment:\n      EULA: "TRUE"', 'environment:\n      - EULA=TRUE\n      - DIFFICULTY=hard')
          .replace(/labels:\n(?:\s+#.*\n|\s+mc-router.*\n)+/, 'labels:\n      - "mc-router.host=s.local,x.example.com"\n      - "mc-router.auto-scale-up=true"\n'),
    });
    const { document } = await imp('s');
    expect(document!.env['DIFFICULTY']).toBe('hard');
    expect(document!.routing.customHostnames).toEqual(['x.example.com']);
    expect(document!.routing.autoScale).toEqual({ up: true, down: false });
  });

  it('moves environment into the spec; compose wins a clash and the clash is reported', async () => {
    templateServer('s', {
      compose: (c) =>
        c.replace('EULA: "TRUE"', 'EULA: "TRUE"\n      MEMORY: 8G\n      DIFFICULTY: hard\n      NEW_KEY: 1'),
    });
    const { document, warnings } = await imp('s');
    expect(document!.memory).toBe('8G');
    expect(document!.env['DIFFICULTY']).toBe('hard');
    expect(document!.env['NEW_KEY']).toBe('1');
    expect(document!.env['EULA']).toBeUndefined();
    const text = warnings.join('\n');
    expect(text).toMatch(/MEMORY.*8G.*4G/);
    expect(text).toMatch(/DIFFICULTY.*hard.*normal/);
    expect(text).toMatch(/NEW_KEY/);
  });

  it.each([
    ['image', (c: string) => c.replace('itzg/minecraft-server:java25', 'itzg/minecraft-server:${TAG}')],
    ['mc-router.host', (c: string) => c.replace('"s.local,', '"${HOST},')],
    ['environment', (c: string) => c.replace('EULA: "TRUE"', 'EULA: "TRUE"\n      MOTD: ${MOTD}')],
    ['environment', (c: string) => c.replace('EULA: "TRUE"', 'EULA: "TRUE"\n      PASSTHROUGH:')],
  ])('refuses ${...} or a pass-through in %s', async (what, edit) => {
    templateServer('s', { compose: edit });
    expect(await imp('s')).toMatchObject({ status: 'refused' });
  });

  it('refuses compose that does not parse or does not define exactly mc-<name>', async () => {
    templateServer('a', { compose: () => 'services: [unclosed\n' });
    templateServer('b', { compose: (c) => c.replace(/mc-b:/, 'mc-other:') });
    expect(await imp('a')).toMatchObject({ status: 'refused', reason: expect.stringMatching(/parse/) });
    expect(await imp('b')).toMatchObject({ status: 'refused', reason: expect.stringMatching(/mc-b/) });
  });
});
