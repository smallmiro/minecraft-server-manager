import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Config, type Paths } from '@minecraft-docker/shared';
import { writeFileAtomic } from '@minecraft-docker/shared/utils';
import { ECOSYSTEM_CONFIG_FILE } from './pm2-utils.js';

const KEYS = ['BETTER_AUTH_SECRET', 'BETTER_AUTH_BASE_URL'] as const;

/** Whole `KEY: '<value>',` line as older `mcctl console init` generated it (text parse, never evaluated). */
const lineRe = (key: string) => new RegExp(`^[ \\t]*${key}[ \\t]*:[ \\t]*'([^'\\\\\\n]+)'[ \\t]*,?[ \\t]*(?:\\r?\\n|$)`, 'm');

export interface ConsoleAuthMigrationResult {
  /** Keys moved (dry-run: that would be moved) from ecosystem.config.cjs into .env. */
  moved: string[];
  /** Keys left in the ecosystem because .env cannot store the value safely. */
  skipped: string[];
}

/**
 * The console uses a .env BETTER_AUTH_* value only once ecosystem.config.cjs
 * stops defining the key (#699), so a value still living there moves into .env. The
 * ecosystem value is the one the running console uses, so it overwrites .env
 * and sessions stay valid. Values are never returned or logged.
 */
export async function migrateConsoleAuthEnv(paths: Paths, dryRun: boolean): Promise<ConsoleAuthMigrationResult> {
  const result: ConsoleAuthMigrationResult = { moved: [], skipped: [] };
  const ecoPath = join(paths.root, ECOSYSTEM_CONFIG_FILE);
  if (!existsSync(ecoPath)) return result;

  const original = readFileSync(ecoPath, 'utf-8');
  const found = KEYS.flatMap((key) => {
    const m = lineRe(key).exec(original);
    return m?.[1] !== undefined ? [{ key, value: m[1] }] : [];
  });
  if (found.length === 0) return result;
  if (dryRun) {
    result.moved = found.map((f) => f.key);
    return result;
  }

  const config = new Config(paths);
  let stripped = original;
  let backedUp = false;
  for (const { key, value } of found) {
    try {
      await config.updateEnv({ [key]: value });
    } catch {
      result.skipped.push(key);
      continue;
    }
    if (!backedUp) {
      copyFileSync(ecoPath, `${ecoPath}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`);
      backedUp = true;
    }
    stripped = stripped.replace(lineRe(key), '');
    result.moved.push(key);
  }
  if (stripped !== original) await writeFileAtomic(ecoPath, stripped);
  return result;
}
