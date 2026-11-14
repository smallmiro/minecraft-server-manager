/**
 * image-pins.json (#663) lists exactly the images mcctl uses, each with a
 * digest. A new or dropped image in code fails here until the list follows.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { McVersion, DEFAULT_SERVER_IMAGE } from '@minecraft-docker/shared';
import { PLAYIT_IMAGE } from '../../src/commands/playit.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const read = (...p: string[]) => readFileSync(join(REPO_ROOT, ...p), 'utf-8');
const TEMPLATES = join('platform', 'services', 'cli', 'templates');

const pins = JSON.parse(read('image-pins.json')) as {
  release: string;
  checkedAt: string;
  images: { image: string; digest: string; platforms: string[] }[];
};

const composeImages = (file: string): string[] => {
  const doc = yaml.load(read(file)) as { services: Record<string, { image?: string }> };
  return Object.values(doc.services).flatMap((s) => (s.image ? [s.image] : []));
};

const bluemapFrom = /^FROM\s+(\S+?)(?:@(sha256:\S+))?\s*$/m.exec(read('platform', 'docker', 'bluemap', 'Dockerfile'))!;

const REPRESENTATIVE = ['1.12.2', '1.16.5', '1.17.1', '1.20.4', '1.20.6', '1.21.4', '26.1', 'LATEST'];
const serverTags = REPRESENTATIVE.map(
  (v) => `itzg/minecraft-server:${v === 'LATEST' ? 'java25' : McVersion.create(v).recommendedImageTag}`
);

describe('image-pins.json', () => {
  it('lists exactly the images the code uses', () => {
    const used = new Set([
      ...serverTags,
      DEFAULT_SERVER_IMAGE,
      ...composeImages(join(TEMPLATES, 'docker-compose.yml')),
      ...composeImages(join(TEMPLATES, 'servers', '_template', 'docker-compose.yml')),
      PLAYIT_IMAGE,
      bluemapFrom[1]!,
    ]);
    expect(pins.images.map((i) => i.image).sort()).toEqual([...used].sort());
  });

  it('gives every image a digest and linux platforms', () => {
    for (const i of pins.images) {
      expect(i.digest, i.image).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(i.platforms.length, i.image).toBeGreaterThan(0);
    }
    expect(pins.release).toBeTruthy();
    expect(pins.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('pins the BlueMap base image by the same digest as the Dockerfile', () => {
    expect(bluemapFrom[2]).toBeDefined();
    expect(pins.images.find((i) => i.image === bluemapFrom[1])?.digest).toBe(bluemapFrom[2]);
  });
});
