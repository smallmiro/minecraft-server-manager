import { join, dirname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Resolve the mcctl-api package root (the directory containing its package.json)
 * starting from this module's location.
 *
 * The compiled module lives at `<pkgRoot>/dist/lib/script-resolver.js`, so we
 * walk up until we find the `@minecraft-docker/mcctl-api` package.json.
 */
function getApiPackageRoot(): string {
  const start = dirname(fileURLToPath(import.meta.url));
  let dir = start;

  while (dir !== dirname(dir)) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.name === '@minecraft-docker/mcctl-api') {
          return dir;
        }
      } catch {
        // Ignore malformed package.json and keep walking up.
      }
    }
    dir = dirname(dir);
  }

  return start;
}

/** Directory of the Docker build contexts bundled with the package (synced from `platform/docker`). */
export function getBundledDockerDir(): string {
  return join(getApiPackageRoot(), 'docker');
}

/**
 * `platform/docker` when running from the monorepo source tree (the package
 * sits at `platform/services/mcctl-api`), the way `Paths` finds
 * `platform/scripts`. Does not exist in an npm install.
 */
export function getRepoDockerDir(): string {
  return join(getApiPackageRoot(), '..', '..', 'docker');
}

/**
 * BlueMap image build context: the version-matched copy bundled with the
 * package, else the monorepo source `platform/docker/bluemap`, else
 * `<mcctlRoot>/docker/bluemap`. The renderer only needs it when the image is
 * missing, and reports a missing Dockerfile itself.
 */
export function resolveBlueMapDockerDir(
  mcctlRoot: string,
  bundledDockerDir: string = getBundledDockerDir(),
  repoDockerDir: string = getRepoDockerDir(),
): string {
  const candidates = [bundledDockerDir, repoDockerDir].map((dir) => join(dir, 'bluemap'));
  return candidates.find((dir) => existsSync(join(dir, 'Dockerfile'))) ?? join(mcctlRoot, 'docker', 'bluemap');
}
