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

/**
 * Directory of the scripts bundled with the mcctl-api package.
 *
 * These are synced from `platform/scripts` at publish time (see the
 * `sync-scripts` npm script) and are therefore version-matched with the API.
 * In a development build (running from `src/` via tsx) this directory does not
 * exist, in which case the resolver falls back to the deployed platform copy.
 */
export function getBundledScriptsDir(): string {
  return join(getApiPackageRoot(), 'scripts');
}

export interface ResolvedScript {
  /** Absolute path to the resolved `.sh` script. */
  scriptPath: string;
  /** Directory containing the script (exported as MCCTL_SCRIPTS to the script). */
  scriptsDir: string;
}

/**
 * Resolve the script to execute for a given script name.
 *
 * Resolution order:
 *   1. Bundled scripts shipped with mcctl-api (version-matched).
 *   2. Scripts deployed under `<platformPath>/scripts` (legacy / may be stale).
 *
 * Returns `null` when the script is found in neither location, signalling the
 * caller to fall back to the globally installed `mcctl` CLI.
 */
export function resolveScriptPath(
  scriptName: string,
  platformPath: string,
  bundledScriptsDir: string = getBundledScriptsDir(),
): ResolvedScript | null {
  const bundled = join(bundledScriptsDir, scriptName);
  if (existsSync(bundled)) {
    return { scriptPath: bundled, scriptsDir: bundledScriptsDir };
  }

  const deployedDir = join(platformPath, 'scripts');
  const deployed = join(deployedDir, scriptName);
  if (existsSync(deployed)) {
    return { scriptPath: deployed, scriptsDir: deployedDir };
  }

  return null;
}
