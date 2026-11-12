/**
 * migrateComposeKeys (#661, #662): `mcctl upgrade` adds the template's
 * stop_grace_period and logging to server composes written before them,
 * after a backup.
 * Real temp platform, real bundled template, real FileServerSpecRepository.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { FileServerSpecRepository, Paths } from '@minecraft-docker/shared';
import { migrateComposeKeys } from '../../../src/lib/server-compose-keys-migration.js';

const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), '../../../templates');
const TEMPLATE_COMPOSE = readFileSync(join(TEMPLATES, 'servers/_template/docker-compose.yml'), 'utf-8');
/** A server compose as mcctl wrote it before #662: the template without logging. */
const V661 = (name: string) =>
  TEMPLATE_COMPOSE.replace(/mc-template/g, `mc-${name}`)
    .replace('mc-router.host: "template.local"', `mc-router.host: "${name}.local"`)
    .replace(/^ *# Rotate the container log[\s\S]*?max-file:.*\n/m, '');
/** A server compose as mcctl wrote it before #661: also without stop_grace_period. */
const OLD = (name: string) => V661(name).replace(/^ *# Longer than[\s\S]*?stop_grace_period:.*\n/m, '');
const LOGGING = '    logging:\n      driver: "json-file"\n      options:\n        max-size: "50m"\n        max-file: "5"\n';

let root: string;
const dir = (name: string) => join(root, 'servers', name);
const compose = (name: string) => readFileSync(join(dir(name), 'docker-compose.yml'), 'utf-8');
const grace = (name: string) =>
  (yaml.load(compose(name)) as { services: Record<string, Record<string, unknown>> }).services[`mc-${name}`]![
    'stop_grace_period'
  ];
const logging = (name: string) =>
  (yaml.load(compose(name)) as { services: Record<string, Record<string, unknown>> }).services[`mc-${name}`]!['logging'];
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

describe('migrateComposeKeys (#661, #662)', () => {
  it('adds the template values after a backup, changing no other line', () => {
    expect(OLD('a')).not.toMatch(/stop_grace_period|logging/);
    server('a');
    server('custom', OLD('custom').replace('    tty: true', '    stop_grace_period: 30s\n    tty: true'));
    server('_template');

    const result = migrateComposeKeys(root, TEMPLATES, false);

    expect(result).toEqual({ updated: ['a', 'custom'], skipped: [], noMemLimit: ['a', 'custom'] });
    expect(compose('a')).toBe(OLD('a').replace('  mc-a:\n', `  mc-a:\n    stop_grace_period: "90s"\n${LOGGING}`));
    expect(grace('a')).toBe('90s');
    expect(logging('a')).toEqual({ driver: 'json-file', options: { 'max-size': '50m', 'max-file': '5' } });
    expect(backups('a').map((f) => readFileSync(join(dir('a'), f), 'utf-8'))).toEqual([OLD('a')]);
    expect(grace('custom')).toBe('30s');
    expect(logging('custom')).toEqual(logging('a'));
    expect(compose('_template')).toBe(OLD('_template'));
  });

  it('adds only logging to a compose written between #661 and #662', () => {
    server('a', V661('a'));

    expect(migrateComposeKeys(root, TEMPLATES, false)).toEqual({ updated: ['a'], skipped: [], noMemLimit: ['a'] });
    expect(compose('a')).toBe(V661('a').replace('  mc-a:\n', `  mc-a:\n${LOGGING}`));
  });

  it('keeps a logging setting of its own', () => {
    server('a', V661('a').replace('    tty: true', '    logging:\n      driver: local\n    tty: true'));

    expect(migrateComposeKeys(root, TEMPLATES, false)).toEqual({ updated: [], skipped: [], noMemLimit: ['a'] });
    expect(logging('a')).toEqual({ driver: 'local' });
  });

  it('adds valid YAML to a compose indented with 4 spaces', () => {
    server('a', OLD('a').replace(/^( +)/gm, (m) => m + m));

    expect(migrateComposeKeys(root, TEMPLATES, false).updated).toEqual(['a']);
    expect(grace('a')).toBe('90s');
    expect(logging('a')).toEqual({ driver: 'json-file', options: { 'max-size': '50m', 'max-file': '5' } });
  });

  it('is idempotent', () => {
    server('a');
    migrateComposeKeys(root, TEMPLATES, false);
    const after = compose('a');

    expect(migrateComposeKeys(root, TEMPLATES, false)).toEqual({ updated: [], skipped: [], noMemLimit: ['a'] });
    expect(compose('a')).toBe(after);
    expect(backups('a')).toHaveLength(1);
  });

  it('dry-run reports without writing', () => {
    server('a');

    expect(migrateComposeKeys(root, TEMPLATES, true)).toEqual({ updated: ['a'], skipped: [], noMemLimit: ['a'] });
    expect(compose('a')).toBe(OLD('a'));
    expect(backups('a')).toEqual([]);
  });

  it('lists servers without mem_limit and never adds one (#662)', () => {
    server('a');
    server('limited', OLD('limited').replace('    tty: true', '    mem_limit: 6g\n    tty: true'));

    expect(migrateComposeKeys(root, TEMPLATES, false).noMemLimit).toEqual(['a']);
    expect(compose('a')).not.toContain('mem_limit');
  });

  it('skips a compose it cannot patch safely', () => {
    server('flow', 'services: { mc-flow: { image: x } }\n');
    server('broken', 'services:\n  mc-broken: [\n');

    expect(migrateComposeKeys(root, TEMPLATES, false)).toEqual({ updated: [], skipped: ['broken', 'flow'], noMemLimit: ['flow'] });
    expect(compose('flow')).toBe('services: { mc-flow: { image: x } }\n');
  });

  it('leaves a compose rendered from server.yaml loading without warnings', async () => {
    server('a');
    const repo = new FileServerSpecRepository(new Paths(root), undefined, undefined, () => []);
    const imported = (await repo.load('a'))!;
    await repo.write(imported.document, { expectedRevision: imported.revision });
    // As rendered before #661 and #662: the generated file without the keys (hash no longer matches, like an upgrade edit)
    writeFileSync(join(dir('a'), 'docker-compose.yml'), compose('a').replace(/^ *stop_grace_period:.*\n/m, '').replace(/^ *logging:\n(?: {6,}.*\n)+/m, ''));

    expect(migrateComposeKeys(root, TEMPLATES, false).updated).toEqual(['a']);

    const loaded = (await repo.load('a'))!;
    expect(loaded.warnings).toEqual([]);
    expect(loaded.document).toEqual(imported.document);
    expect(grace('a')).toBe('90s');
    expect(logging('a')).toEqual({ driver: 'json-file', options: { 'max-size': '50m', 'max-file': '5' } });
  });
});
