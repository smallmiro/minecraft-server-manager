/**
 * ensurePlayitService (#671): the playit service goes into a user's
 * docker-compose.yml through the re-parse-checked patch, with a backup; a
 * file it cannot patch safely stays byte for byte.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { Paths } from '@minecraft-docker/shared';
import { ensurePlayitService } from '../../../src/commands/playit.js';

let root: string;
const compose = () => join(root, 'docker-compose.yml');

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-playit-compose-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('ensurePlayitService', () => {
  it('adds playit to a hand-edited compose (4-space indent, volumes last) and keeps a backup', () => {
    const user = `services:
    router:
        image: itzg/mc-router:1.47.1  # mine

volumes:
    data: {}
`;
    writeFileSync(compose(), user);

    ensurePlayitService(new Paths(root));

    const doc = yaml.load(readFileSync(compose(), 'utf-8')) as { services: Record<string, Record<string, unknown>>; volumes: unknown };
    expect(doc.services['playit']!['image']).toBe('ghcr.io/playit-cloud/playit-agent:0.16');
    expect(doc.services['playit']!['container_name']).toBe('playit-agent');
    expect(doc.volumes).toEqual({ data: {} });
    const backup = readdirSync(root).find((f) => f.startsWith('docker-compose.yml.bak'));
    expect(backup).toBeDefined();
    expect(readFileSync(join(root, backup!), 'utf-8')).toBe(user);
  });

  it('leaves a compose it cannot patch safely untouched', () => {
    const user = 'services: { router: { image: itzg/mc-router:1.47.1 } }\n';
    writeFileSync(compose(), user);

    ensurePlayitService(new Paths(root));

    expect(readFileSync(compose(), 'utf-8')).toBe(user);
    expect(readdirSync(root)).toEqual(['docker-compose.yml']);
  });
});
