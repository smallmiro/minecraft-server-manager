/**
 * scripts/pin-images.mjs (#663): runs the real script against a copy of the
 * repo layout with a fake docker first on PATH (no registry access).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const D = 'sha256:' + 'a'.repeat(64);

// Fake docker: `buildx imagetools inspect <ref> --format ...`; refs containing "noarm" lack arm64.
const FAKE_DOCKER = `#!/bin/sh
ref="$4"
arm='{"platform":{"architecture":"arm64","os":"linux","variant":"v8"}},'
case "$ref" in *noarm*) arm='' ;; esac
echo '{"digest":"${D}","manifests":['"$arm"'{"platform":{"architecture":"amd64","os":"linux"}},{"platform":{"architecture":"unknown","os":"unknown"}}]}'
`;

let root: string;
const pinsPath = () => join(root, 'image-pins.json');
const run = () =>
  spawnSync('node', [join(root, 'scripts', 'pin-images.mjs'), '9.9.9'], {
    encoding: 'utf-8',
    env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}` },
  });

const writePins = (images: string[]) =>
  writeFileSync(
    pinsPath(),
    JSON.stringify({
      release: 'unreleased',
      checkedAt: '2000-01-01',
      images: images.map((image) => ({ image, digest: 'sha256:' + '0'.repeat(64), platforms: [] })),
    })
  );

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'pin-images-'));
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'bin'));
  copyFileSync(join(REPO_ROOT, 'scripts', 'pin-images.mjs'), join(root, 'scripts', 'pin-images.mjs'));
  writeFileSync(join(root, 'bin', 'docker'), FAKE_DOCKER);
  chmodSync(join(root, 'bin', 'docker'), 0o755);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('pin-images.mjs', () => {
  it('rewrites digest, platforms and release, and prints a markdown table', () => {
    writePins(['a/b:1']);
    const r = run();
    expect(r.status).toBe(0);
    const pins = JSON.parse(readFileSync(pinsPath(), 'utf-8'));
    expect(pins.release).toBe('9.9.9');
    expect(pins.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(pins.checkedAt).not.toBe('2000-01-01');
    expect(pins.images[0]).toEqual({
      image: 'a/b:1',
      digest: D,
      platforms: ['linux/amd64', 'linux/arm64/v8'],
    });
    expect(r.stdout).toContain(`| \`a/b:1\` | \`${D}\` | linux/amd64, linux/arm64/v8 |`);
  });

  it('exits 1 and names the image when linux/arm64 is missing', () => {
    writePins(['a/b:1', 'c/noarm:2']);
    const r = run();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('c/noarm:2: no linux/arm64');
    expect(r.stderr).not.toContain('a/b:1');
  });
});
