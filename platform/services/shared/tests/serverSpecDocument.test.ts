/**
 * ServerSpecDocument validation (#675, ADR-0003 §1): create rules vs the
 * rules for an existing (imported) server, strict file shape, actionable errors.
 */
import { describe, it, expect } from 'vitest';
import {
  ServerSpecError,
  assertServerSpecDocument,
  validateHostname,
  validateServerSpecDocument,
  type ServerSpecDocument,
} from '../src/domain/server-spec/ServerSpecDocument.js';

function doc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const base: ServerSpecDocument = {
    specVersion: 1,
    name: 'survival',
    type: 'PAPER',
    version: '1.21.1',
    memory: '4G',
    image: 'itzg/minecraft-server:java25',
    world: { level: 'survival', storage: 'universe' },
    routing: {
      customHostnames: ['mc.example.com'],
      playitDomain: 'aa.example.com',
      autoScale: { up: true, down: true },
      asleepMotd: 'zzz\nwake up',
    },
    env: { GAMEMODE: 'survival', ENABLE_RCON: 'true' },
  };
  return { ...base, ...overrides };
}

const paths = (value: unknown, rules: 'create' | 'existing' = 'create') =>
  validateServerSpecDocument(value, rules).map((i) => i.path);

describe('validateServerSpecDocument', () => {
  it('accepts a full document under both rules', () => {
    expect(validateServerSpecDocument(doc(), 'create')).toEqual([]);
    expect(validateServerSpecDocument(doc(), 'existing')).toEqual([]);
  });

  it('accepts a document without the optional fields', () => {
    const minimal = doc({ version: undefined, memory: undefined, env: {} });
    delete minimal['version'];
    delete minimal['memory'];
    minimal['routing'] = { customHostnames: [], autoScale: { up: false, down: false } };
    expect(validateServerSpecDocument(minimal, 'create')).toEqual([]);
  });

  it('lists every missing field of a bare v2 { name }', () => {
    expect(paths({ name: 'survival' })).toEqual(['specVersion', 'type', 'image', 'world', 'routing', 'env']);
  });

  it('rejects unknown keys at every level with their path', () => {
    const value = doc({ extra: 1, world: { level: 'w', storage: 'data', x: 1 } });
    (value['routing'] as Record<string, unknown>)['autoScale'] = { up: true, down: true, sideways: true };
    expect(paths(value)).toEqual(['world.x', 'routing.autoScale.sideways', 'extra']);
  });

  it('rejects non-string scalars and says to quote them', () => {
    const issues = validateServerSpecDocument(doc({ version: 1.21, env: { SEED: 12345 } }), 'existing');
    expect(issues.map((i) => i.path)).toEqual(['version', 'env.SEED']);
    expect(issues[0]!.message).toMatch(/quote/);
  });

  it('applies the strict value objects only on create', () => {
    const legacy = doc({
      name: 'Old_Server',
      type: 'CUSTOM_TYPE',
      version: 'bad/version',
      memory: '300M',
      world: { level: 'My World', storage: 'universe' },
    });
    expect(paths(legacy, 'create')).toEqual(['name', 'type', 'version', 'memory', 'world.level']);
    expect(validateServerSpecDocument(legacy, 'existing')).toEqual([]);
  });

  it('refuses names and worlds unsafe even for an existing server', () => {
    expect(paths(doc({ name: '../x', world: { level: '..', storage: 'data' } }), 'existing')).toEqual([
      'name',
      'world.level',
    ]);
  });

  it('refuses dimension folders as a new world', () => {
    expect(paths(doc({ world: { level: 'w_nether', storage: 'universe' } }))).toEqual(['world.level']);
  });

  it('checks storage, hostnames and autoScale types', () => {
    const value = doc({ world: { level: 'w', storage: 'elsewhere' } });
    value['routing'] = {
      customHostnames: ['ok.example.com', 'bad host'],
      playitDomain: '-x.example.com',
      autoScale: { up: 'true', down: true },
    };
    expect(paths(value)).toEqual([
      'world.storage',
      'routing.customHostnames[1]',
      'routing.playitDomain',
      'routing.autoScale.up',
    ]);
  });

  it('keeps managed keys and --universe out of env', () => {
    const issues = validateServerSpecDocument(
      doc({ env: { TYPE: 'PAPER', LEVEL: 'w', EXTRA_ARGS: '--universe /worlds/ -Dx=1' } }),
      'existing'
    );
    expect(issues.map((i) => i.path)).toEqual(['env.TYPE', 'env.LEVEL', 'env.EXTRA_ARGS']);
    expect(issues[0]!.message).toMatch(/type/);
    expect(issues[2]!.message).toMatch(/world\.storage/);
  });

  it('allows other EXTRA_ARGS in env', () => {
    expect(validateServerSpecDocument(doc({ env: { EXTRA_ARGS: '-Dfoo=1' } }), 'create')).toEqual([]);
  });

  it('applies the env key and value rules (#726)', () => {
    expect(paths(doc({ env: { 'bad-key': 'x', MOTD: '"quoted', ICON: 'a\nb' } }), 'existing')).toEqual([
      'env.bad-key',
      'env.MOTD',
      'env.ICON',
    ]);
  });

  it('reports an unknown specVersion', () => {
    expect(paths(doc({ specVersion: 2 }))).toEqual(['specVersion']);
  });
});

describe('assertServerSpecDocument', () => {
  const where = { server: 'survival', file: 'servers/survival/server.yaml' };

  it('returns the document when valid', () => {
    expect(assertServerSpecDocument(doc(), 'existing', where).name).toBe('survival');
  });

  it('throws invalid_spec naming the server, file and fields', () => {
    let error: unknown;
    try {
      assertServerSpecDocument({ name: 'survival' }, 'existing', where);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ServerSpecError);
    const e = error as ServerSpecError;
    expect(e.code).toBe('invalid_spec');
    expect(e.server).toBe('survival');
    expect(e.message).toContain('servers/survival/server.yaml');
    expect(e.message).toContain('type');
    expect(e.issues.map((i) => i.path)).toContain('image');
  });

  it('throws unsupported_spec_version for a newer file and says to upgrade', () => {
    expect(() => assertServerSpecDocument(doc({ specVersion: 2 }), 'existing', where)).toThrow(
      expect.objectContaining({ code: 'unsupported_spec_version', message: expect.stringMatching(/upgrade mcctl/) })
    );
  });
});

describe('validateHostname', () => {
  it.each(['mc.example.com', 'a', 'survival.local', 'x.192.168.1.2.nip.io', 'MC.Example.com'])('accepts %s', (h) => {
    expect(validateHostname(h)).toBeUndefined();
  });

  it.each(['', 'bad host', '-a.com', 'a-.com', 'a..b', `${'a'.repeat(64)}.com`, 'a_b.com'])('rejects %j', (h) => {
    expect(validateHostname(h)).toBeTypeOf('string');
  });
});
