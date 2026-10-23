/**
 * buildCreateSpec (#675, ADR-0003 §5): one row per create-server.sh option.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { buildCreateSpec, DEFAULT_SERVER_IMAGE } from '../src/domain/server-spec/buildCreateSpec.js';
import { validateServerSpecDocument } from '../src/domain/server-spec/ServerSpecDocument.js';

const base = { name: 'alpha', type: 'PAPER', version: '1.21.1', memory: '4G' };

describe('buildCreateSpec', () => {
  it('maps the defaults: own world in worlds/, welcome MOTD, auto-scale, template image', () => {
    const doc = buildCreateSpec(base);
    expect(doc).toEqual({
      specVersion: 1,
      name: 'alpha',
      type: 'PAPER',
      version: '1.21.1',
      memory: '4G',
      image: DEFAULT_SERVER_IMAGE,
      world: { level: 'alpha', storage: 'universe' },
      routing: { customHostnames: [], autoScale: { up: true, down: true } },
      env: { MOTD: 'Welcome to alpha! Your adventure begins here.' },
    });
    expect(validateServerSpecDocument(doc, 'create')).toEqual([]);
  });

  it.each([
    [{ seed: '12345' }, { SEED: '12345' }],
    [{ seed: 'a text seed & more' }, { SEED: 'a text seed & more' }],
    [{ worldUrl: 'https://example.com/w.zip' }, { WORLD: 'https://example.com/w.zip' }],
    [{ enableWhitelist: true }, { ENABLE_WHITELIST: 'TRUE' }],
    [{ enableWhitelist: true, whitelistPlayers: ['steve', 'alex'] }, { ENABLE_WHITELIST: 'TRUE', WHITELIST: 'steve,alex' }],
    [{ enableWhitelist: false, whitelistPlayers: ['steve'] }, {}],
  ])('%j → env %j', (extra, env) => {
    expect(buildCreateSpec({ ...base, ...extra }).env).toEqual({
      MOTD: 'Welcome to alpha! Your adventure begins here.',
      ...env,
    });
  });

  it('uses an existing world as the level', () => {
    expect(buildCreateSpec({ ...base, worldName: 'shared' }).world).toEqual({ level: 'shared', storage: 'universe' });
  });

  it('sets the playit domain on routing', () => {
    expect(buildCreateSpec({ ...base, playitDomain: 'aa.example.com' }).routing.playitDomain).toBe('aa.example.com');
  });

  it.each([
    ['MODRINTH', { MODRINTH_MODPACK: 'pack', MODRINTH_VERSION: '1.0', MODRINTH_LOADER: 'fabric', MODRINTH_EXCLUDE_FILES: 'a.jar,b.jar' }],
    ['AUTO_CURSEFORGE', { CF_SLUG: 'pack', CF_VERSION: '1.0', CF_LOADER: 'fabric', CF_EXCLUDE_MODS: 'a.jar,b.jar' }],
  ])('maps the %s modpack options', (type, env) => {
    const doc = buildCreateSpec({
      ...base,
      type,
      modpackSlug: 'pack',
      modpackVersion: '1.0',
      modLoader: 'fabric',
      modpackExcludeFiles: ['a.jar', 'b.jar'],
    });
    expect(doc.env).toMatchObject(env);
  });

  it('leaves VERSION to the modpack when none is given, LATEST for other types', () => {
    expect(buildCreateSpec({ ...base, version: undefined, type: 'MODRINTH', modpackSlug: 'p' }).version).toBeUndefined();
    expect(buildCreateSpec({ ...base, version: undefined }).version).toBe('LATEST');
  });

  it('ignores modpack options for a type that is not a modpack', () => {
    expect(buildCreateSpec({ ...base, modpackSlug: 'pack' }).env).toEqual({
      MOTD: 'Welcome to alpha! Your adventure begins here.',
    });
  });

  it('uses the image of the bundled template', () => {
    const template = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../cli/templates/servers/_template/docker-compose.yml'),
      'utf-8'
    );
    const svc = Object.values((yaml.load(template) as { services: Record<string, { image: string }> }).services)[0]!;
    expect(svc.image).toBe(DEFAULT_SERVER_IMAGE);
  });
});
