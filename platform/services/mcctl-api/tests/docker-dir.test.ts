import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { resolveBlueMapDockerDir, getRepoDockerDir } from '../src/lib/docker-dir.js';

const TMP = join(import.meta.dirname, '.tmp-docker-dir-test');
const PLATFORM = join(TMP, 'platform');

describe('resolveBlueMapDockerDir', () => {
  const BUNDLED_DOCKER = join(TMP, 'bundled-docker');
  const REPO_DOCKER = join(TMP, 'repo-docker');

  function writeDockerfile(dockerDir: string) {
    mkdirSync(join(dockerDir, 'bluemap'), { recursive: true });
    writeFileSync(join(dockerDir, 'bluemap', 'Dockerfile'), 'FROM scratch\n', 'utf-8');
  }

  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('uses the BlueMap build context bundled with the package first (#733)', () => {
    writeDockerfile(BUNDLED_DOCKER);
    writeDockerfile(REPO_DOCKER);

    expect(resolveBlueMapDockerDir(PLATFORM, BUNDLED_DOCKER, REPO_DOCKER)).toBe(join(BUNDLED_DOCKER, 'bluemap'));
  });

  it('uses the monorepo platform/docker when the package has no bundled copy', () => {
    writeDockerfile(REPO_DOCKER);

    expect(resolveBlueMapDockerDir(PLATFORM, BUNDLED_DOCKER, REPO_DOCKER)).toBe(join(REPO_DOCKER, 'bluemap'));
  });

  it('falls back to <mcctlRoot>/docker/bluemap when neither has a Dockerfile', () => {
    expect(resolveBlueMapDockerDir(PLATFORM, BUNDLED_DOCKER, REPO_DOCKER)).toBe(join(PLATFORM, 'docker', 'bluemap'));
  });

  it('defaults to the monorepo platform/docker when run from source with a separate data root', () => {
    const repoDocker = resolve(import.meta.dirname, '..', '..', '..', 'docker');
    expect(getRepoDockerDir()).toBe(repoDocker);

    const dataRoot = mkdtempSync(join(tmpdir(), 'mcctl-data-'));
    try {
      // Bundled copy (only after sync-scripts/prepack) or the repo source, never the empty data root.
      const dir = resolveBlueMapDockerDir(dataRoot);
      expect(dir.startsWith(dataRoot)).toBe(false);
      expect(existsSync(join(dir, 'Dockerfile'))).toBe(true);
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });
});
