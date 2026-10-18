import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { migrateServerEnv } from '../../../src/lib/server-env-migration.js';

const LEGACY = `services:
  mc-a:
    env_file:
      - ../../.env
      - config.env
`;
const MIGRATED = LEGACY.replace('../../.env', '../global.env');

describe('migrateServerEnv (#685)', () => {
  let root: string;
  let templates: string;
  const serverCompose = (name: string) => join(root, 'servers', name, 'docker-compose.yml');
  const addServer = (name: string, content: string) => {
    mkdirSync(join(root, 'servers', name), { recursive: true });
    writeFileSync(serverCompose(name), content);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mcctl-server-env-'));
    templates = join(root, 'tpl');
    mkdirSync(join(templates, 'servers'), { recursive: true });
    writeFileSync(join(templates, 'servers', 'global.env'), 'TZ\n');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('creates global.env and repoints legacy server compose files', () => {
    addServer('a', LEGACY);
    addServer('b', MIGRATED);
    addServer('_template', LEGACY);

    const result = migrateServerEnv(root, templates, false);

    expect(result).toEqual({ createdGlobalEnv: true, migrated: ['a'] });
    expect(readFileSync(join(root, 'servers', 'global.env'), 'utf-8')).toBe('TZ\n');
    expect(readFileSync(serverCompose('a'), 'utf-8')).toBe(MIGRATED);
    expect(readFileSync(serverCompose('b'), 'utf-8')).toBe(MIGRATED);
    expect(readFileSync(serverCompose('_template'), 'utf-8')).toBe(LEGACY);
  });

  it('is idempotent and keeps a customized global.env', () => {
    addServer('a', LEGACY);
    mkdirSync(join(root, 'servers'), { recursive: true });
    writeFileSync(join(root, 'servers', 'global.env'), 'TZ\nMY_KEY\n');

    migrateServerEnv(root, templates, false);
    const second = migrateServerEnv(root, templates, false);

    expect(second).toEqual({ createdGlobalEnv: false, migrated: [] });
    expect(readFileSync(join(root, 'servers', 'global.env'), 'utf-8')).toBe('TZ\nMY_KEY\n');
  });

  it('dry-run reports without writing', () => {
    addServer('a', LEGACY);

    const result = migrateServerEnv(root, templates, true);

    expect(result).toEqual({ createdGlobalEnv: true, migrated: ['a'] });
    expect(existsSync(join(root, 'servers', 'global.env'))).toBe(false);
    expect(readFileSync(serverCompose('a'), 'utf-8')).toBe(LEGACY);
  });

  it('leaves servers untouched when the bundled global.env is missing', () => {
    addServer('a', LEGACY);
    rmSync(join(templates, 'servers', 'global.env'));

    expect(migrateServerEnv(root, templates, false)).toEqual({ createdGlobalEnv: false, migrated: [] });
    expect(readFileSync(serverCompose('a'), 'utf-8')).toBe(LEGACY);
  });
});
