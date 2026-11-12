/**
 * migrateStopGrace (#661): `mcctl upgrade` adds the template's
 * stop_grace_period to server composes written before it, after a backup.
 * Real temp platform, real bundled template, real FileServerSpecRepository.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { FileServerSpecRepository, Paths } from '@minecraft-docker/shared';
import { migrateStopGrace } from '../../../src/lib/server-stop-grace-migration.js';

const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), '../../../templates');
const TEMPLATE_COMPOSE = readFileSync(join(TEMPLATES, 'servers/_template/docker-compose.yml'), 'utf-8');
/** A server compose as mcctl wrote it before #661: the template without stop_grace_period. */
const OLD = (name: string) =>
  TEMPLATE_COMPOSE.replace(/mc-template/g, `mc-${name}`)
    .replace('mc-router.host: "template.local"', `mc-router.host: "${name}.local"`)
    .replace(/^ *# Longer than[\s\S]*?stop_grace_period:.*\n/m, '');

let root: string;
const dir = (name: string) => join(root, 'servers', name);
const compose = (name: string) => readFileSync(join(dir(name), 'docker-compose.yml'), 'utf-8');
const grace = (name: string) =>
  (yaml.load(compose(name)) as { services: Record<string, Record<string, unknown>> }).services[`mc-${name}`]![
    'stop_grace_period'
  ];
const backups = (name: string) => readdirSync(dir(name)).filter((f) => f.startsWith('docker-compose.yml.bak-'));

function server(name: string, text = OLD(name), config = `TYPE=PAPER\nLEVEL=${name}\nEXTRA_ARGS=--universe /worlds/\n`): void {
  mkdirSync(dir(name), { recursive: true });
  writeFileSync(join(dir(name), 'docker-compose.yml'), text);
  writeFileSync(join(dir(name), 'config.env'), config);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-stop-grace-'));
  mkdirSync(join(root, 'servers'));
  writeFileSync(join(root, 'servers', 'global.env'), 'TZ\n');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('migrateStopGrace (#661)', () => {
  it('adds the template value after a backup, changing no other line', () => {
    expect(OLD('a')).not.toContain('stop_grace_period');
    server('a');
    server('custom', OLD('custom').replace('    tty: true', '    stop_grace_period: 30s\n    tty: true'));
    server('_template');

    const result = migrateStopGrace(root, TEMPLATES, false);

    expect(result).toEqual({ updated: ['a'], skipped: [] });
    expect(grace('a')).toBe('90s');
    expect(compose('a').split('\n').filter((l) => !l.includes('stop_grace_period'))).toEqual(OLD('a').split('\n'));
    expect(backups('a').map((f) => readFileSync(join(dir('a'), f), 'utf-8'))).toEqual([OLD('a')]);
    expect(grace('custom')).toBe('30s');
    expect(backups('custom')).toEqual([]);
    expect(compose('_template')).toBe(OLD('_template'));
  });

  it('is idempotent', () => {
    server('a');
    migrateStopGrace(root, TEMPLATES, false);
    const after = compose('a');

    expect(migrateStopGrace(root, TEMPLATES, false)).toEqual({ updated: [], skipped: [] });
    expect(compose('a')).toBe(after);
    expect(backups('a')).toHaveLength(1);
  });

  it('dry-run reports without writing', () => {
    server('a');

    expect(migrateStopGrace(root, TEMPLATES, true)).toEqual({ updated: ['a'], skipped: [] });
    expect(compose('a')).toBe(OLD('a'));
    expect(backups('a')).toEqual([]);
  });

  it('skips a compose it cannot patch safely', () => {
    server('flow', 'services: { mc-flow: { image: x } }\n');
    server('broken', 'services:\n  mc-broken: [\n');

    expect(migrateStopGrace(root, TEMPLATES, false)).toEqual({ updated: [], skipped: ['broken', 'flow'] });
    expect(compose('flow')).toBe('services: { mc-flow: { image: x } }\n');
  });

  it('leaves a compose rendered from server.yaml loading without warnings', async () => {
    server('a');
    const repo = new FileServerSpecRepository(new Paths(root), undefined, undefined, () => []);
    const imported = (await repo.load('a'))!;
    await repo.write(imported.document, { expectedRevision: imported.revision });
    // As rendered before #661: the generated file without the key (hash no longer matches, like an upgrade edit)
    writeFileSync(join(dir('a'), 'docker-compose.yml'), compose('a').replace(/^ *stop_grace_period:.*\n/m, ''));

    expect(migrateStopGrace(root, TEMPLATES, false).updated).toEqual(['a']);

    const loaded = (await repo.load('a'))!;
    expect(loaded.warnings).toEqual([]);
    expect(loaded.document).toEqual(imported.document);
    expect(grace('a')).toBe('90s');
  });
});
