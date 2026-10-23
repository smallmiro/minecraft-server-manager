/**
 * DockerComposeRenderer (#675, ADR-0003 §3): ServerSpecDocument → config.env,
 * the server docker-compose.yml and the servers/compose.yml include entry.
 * Pure: reads through ctx.read, writes nothing.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { Paths, parseEnvDocument } from '../src/utils/index.js';
import {
  DockerComposeRenderer,
  type RenderContext,
} from '../src/infrastructure/adapters/server-spec/DockerComposeRenderer.js';
import { routerHosts, ServerSpecError, type ServerSpecDocument } from '../src/domain/server-spec/ServerSpecDocument.js';

const ROOT = '/srv/mc';
const TEMPLATES = new Paths(ROOT).templates;
const renderer = new DockerComposeRenderer();

function spec(overrides: Partial<ServerSpecDocument> = {}): ServerSpecDocument {
  return {
    specVersion: 1,
    name: 'survival',
    type: 'PAPER',
    version: '1.21.1',
    memory: '4G',
    image: 'itzg/minecraft-server:java25',
    world: { level: 'survival', storage: 'universe' },
    routing: { customHostnames: [], autoScale: { up: true, down: true } },
    env: { GAMEMODE: 'survival', MOTD: 'Hello' },
    ...overrides,
  };
}

function ctx(files: Record<string, string> = {}, hostIps = ['192.168.1.10']): RenderContext {
  return {
    root: ROOT,
    templatesDir: TEMPLATES,
    hostIps,
    read: (path) => {
      if (path in files) return files[path];
      if (path.startsWith(TEMPLATES)) return readFileSync(path, 'utf-8');
      return undefined;
    },
  };
}

const CONFIG = `${ROOT}/servers/survival/config.env`;
const COMPOSE = `${ROOT}/servers/survival/docker-compose.yml`;
const INCLUDE = `${ROOT}/servers/compose.yml`;

function render(doc: ServerSpecDocument, c = ctx()) {
  const files = Object.fromEntries(renderer.render(doc, c).map((f) => [f.path, f]));
  return { config: files[CONFIG]!, compose: files[COMPOSE]!, include: files[INCLUDE]! };
}

describe('routerHosts', () => {
  it('lists .local, nip.io per address, the playit domain, then custom hosts, deduplicated', () => {
    const doc = spec({
      routing: {
        customHostnames: ['mc.example.com', 'AA.example.com', 'survival.local'],
        playitDomain: 'aa.example.com',
        autoScale: { up: true, down: true },
      },
    });
    expect(routerHosts(doc, ['10.0.0.1', '10.0.0.2'])).toEqual([
      'survival.local',
      'survival.10.0.0.1.nip.io',
      'survival.10.0.0.2.nip.io',
      'aa.example.com',
      'mc.example.com',
    ]);
  });
});

describe('config.env', () => {
  it('starts from the bundled template: projected keys set, other template keys removed, comments kept', () => {
    const { config } = render(spec());
    expect(config.guarded).toBe(true);
    const values = Object.fromEntries(parseEnvDocument(config.content).values);
    expect(values).toEqual({
      TYPE: 'PAPER',
      VERSION: '1.21.1',
      MEMORY: '4G',
      GAMEMODE: 'survival',
      LEVEL: 'survival',
      EXTRA_ARGS: '--universe /worlds/',
      MOTD: 'Hello',
    });
    expect(config.content).toContain('# Options: peaceful, easy, normal, hard');
  });

  it('keeps untouched lines byte-identical and writes changed values raw', () => {
    const current = [
      '# my notes',
      'TYPE=PAPER',
      'VERSION=1.20.4',
      'MEMORY=4G',
      'MOTD="Hello" # quoted on purpose',
      'LEVEL=survival',
      'EXTRA_ARGS=--universe /worlds/',
      'GAMEMODE=creative',
      'OLD_KEY=gone',
      '',
    ].join('\n');
    const { config } = render(spec({ env: { GAMEMODE: 'survival', MOTD: 'Hello', NEW_KEY: 'a b' } }), ctx({ [CONFIG]: current }));
    expect(config.content).toBe(
      [
        '# my notes',
        'TYPE=PAPER',
        'VERSION=1.21.1',
        'MEMORY=4G',
        'MOTD="Hello" # quoted on purpose',
        'LEVEL=survival',
        'EXTRA_ARGS=--universe /worlds/',
        'GAMEMODE=survival',
        'NEW_KEY=a b',
        '',
      ].join('\n')
    );
  });

  it('omits VERSION, MEMORY and PLAYIT_DOMAIN when absent and sets PLAYIT_DOMAIN when present', () => {
    const doc = spec({ routing: { customHostnames: [], playitDomain: 'p.example.com', autoScale: { up: true, down: true } } });
    delete doc.version;
    delete doc.memory;
    const values = parseEnvDocument(render(doc).config.content).values;
    expect(values.has('VERSION')).toBe(false);
    expect(values.has('MEMORY')).toBe(false);
    expect(values.get('PLAYIT_DOMAIN')).toBe('p.example.com');
  });

  it.each([
    ['universe', undefined, '--universe /worlds/'],
    ['universe', '-Dx=1', '--universe /worlds/ -Dx=1'],
    ['data', undefined, ''],
    ['data', '-Dx=1', '-Dx=1'],
  ] as const)('EXTRA_ARGS for %s storage with env %s', (storage, extra, expected) => {
    const doc = spec({ world: { level: 'survival', storage }, env: extra ? { EXTRA_ARGS: extra } : {} });
    expect(parseEnvDocument(render(doc).config.content).values.get('EXTRA_ARGS')).toBe(expected);
  });
});

describe('docker-compose.yml', () => {
  it('renders the template service as mc-<name> with the spec image and router labels', () => {
    const doc = spec({
      image: 'itzg/minecraft-server:java21',
      routing: {
        customHostnames: ['mc.example.com'],
        playitDomain: 'p.example.com',
        autoScale: { up: true, down: false },
        asleepMotd: 'zzz',
      },
    });
    const { compose } = render(doc);
    expect(compose.guarded).toBe(true);
    const parsed = yaml.load(compose.content) as { services: Record<string, Record<string, unknown>> };
    expect(Object.keys(parsed.services)).toEqual(['mc-survival']);
    const svc = parsed.services['mc-survival']!;
    expect(svc['container_name']).toBe('mc-survival');
    expect(svc['image']).toBe('itzg/minecraft-server:java21');
    expect(svc['env_file']).toEqual(['../global.env', 'config.env']);
    expect(svc['environment']).toEqual({ EULA: 'TRUE' });
    expect(svc['labels']).toEqual({
      'mc-router.host': 'survival.local,survival.192.168.1.10.nip.io,p.example.com,mc.example.com',
      'mc-router.auto-scale-up': 'true',
      'mc-router.auto-scale-down': 'false',
      'mc-router.auto-scale-asleep-motd': 'zzz',
      'mc-router.auto-scale-loading-motd': '§a§lServer is starting...§r\n§7Please wait!',
    });
  });

  it('quotes the router label so the v2 label readers still match it', async () => {
    const { parseRouterHosts } = await import('../src/docker/index.js');
    expect(parseRouterHosts(render(spec()).compose.content)).toEqual(['survival.local', 'survival.192.168.1.10.nip.io']);
  });

  it('is the same bytes on every render', () => {
    expect(render(spec()).compose.content).toBe(render(spec()).compose.content);
    expect(render(spec()).config.content).toBe(render(spec()).config.content);
  });

  it('re-rendering its own config.env output changes nothing', () => {
    const first = render(spec()).config.content;
    expect(render(spec(), ctx({ [CONFIG]: first })).config.content).toBe(first);
  });
});

describe('servers/compose.yml', () => {
  it('creates the include list when the file is missing', () => {
    const { include } = render(spec());
    expect(include.guarded).toBe(false);
    expect((yaml.load(include.content) as { include: unknown[] }).include).toEqual(['survival/docker-compose.yml']);
  });

  it('adds the entry and keeps every other entry, long form included', () => {
    const current = 'include:\n  - alpha/docker-compose.yml\n  - path: beta/docker-compose.yml\n    project_directory: beta\n';
    const { include } = render(spec(), ctx({ [INCLUDE]: current }));
    expect((yaml.load(include.content) as { include: unknown[] }).include).toEqual([
      'alpha/docker-compose.yml',
      { path: 'beta/docker-compose.yml', project_directory: 'beta' },
      'survival/docker-compose.yml',
    ]);
  });

  it.each([
    'include:\n  - survival/docker-compose.yml # mine\n',
    'include:\n  - path: survival/docker-compose.yml\n',
    'include:\n  - path:\n      - survival/docker-compose.yml\n',
  ])('returns the file unchanged when an entry already names the server (%j)', (current) => {
    expect(render(spec(), ctx({ [INCLUDE]: current })).include.content).toBe(current);
  });

  it('matches the entry by exact name only', () => {
    const current = 'include:\n  - survival2/docker-compose.yml\n';
    expect((yaml.load(render(spec(), ctx({ [INCLUDE]: current })).include.content) as { include: unknown[] }).include).toEqual([
      'survival2/docker-compose.yml',
      'survival/docker-compose.yml',
    ]);
  });

  it.each(['include: [unclosed\n', 'include: nope\n', 'services: {}\n- x\n'])('refuses a file it cannot read as an include list (%j)', (current) => {
    expect(() => renderer.render(spec(), ctx({ [INCLUDE]: current }))).toThrow(ServerSpecError);
  });

  it('accepts a file with an empty include', () => {
    expect((yaml.load(render(spec(), ctx({ [INCLUDE]: 'include:\n' })).include.content) as { include: unknown[] }).include).toEqual([
      'survival/docker-compose.yml',
    ]);
  });
});

describe('purity', () => {
  it('reads the template only through ctx.read and returns absolute paths under the root', () => {
    const reads: string[] = [];
    const c = ctx();
    const files = renderer.render(spec(), { ...c, read: (p) => (reads.push(p), c.read(p)) });
    expect(files.map((f) => f.path).sort()).toEqual([COMPOSE, CONFIG, INCLUDE].sort());
    expect(reads).toContain(join(TEMPLATES, 'servers', '_template', 'docker-compose.yml'));
  });
});
