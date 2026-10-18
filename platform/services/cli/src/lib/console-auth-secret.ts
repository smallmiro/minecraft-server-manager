import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { Config, type Paths } from '@minecraft-docker/shared';

/** `BETTER_AUTH_SECRET: '<value>',` as older `mcctl console init` versions generated it. */
const LEGACY_SECRET_RE = /^\s*BETTER_AUTH_SECRET\s*:\s*'([^'\\\n]+)'/m;

/** Secret an older ecosystem.config.cjs injects (text parse, never evaluated). */
export function readLegacyAuthSecret(ecosystemPath: string): string | undefined {
  if (!existsSync(ecosystemPath)) return undefined;
  return LEGACY_SECRET_RE.exec(readFileSync(ecosystemPath, 'utf-8'))?.[1];
}

/**
 * Keep the console session secret in the platform .env (#686): an existing
 * value stays, else the legacy ecosystem secret moves over (sessions survive),
 * else a new one is generated.
 */
export async function ensureConsoleAuthSecret(
  paths: Paths,
  legacySecret: string | undefined
): Promise<'kept' | 'migrated' | 'generated'> {
  const config = new Config(paths);
  if (config.loadEnv().BETTER_AUTH_SECRET) return 'kept';
  await config.updateEnv({ BETTER_AUTH_SECRET: legacySecret ?? randomBytes(32).toString('hex') });
  return legacySecret ? 'migrated' : 'generated';
}
