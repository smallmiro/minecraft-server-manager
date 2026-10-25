import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnvDocument } from '@minecraft-docker/shared/utils';

const KEYS = ['BETTER_AUTH_SECRET', 'BETTER_AUTH_BASE_URL'];

// Text probe only (never require/eval the CJS file); mirrors mcctl-api probeEcosystem.
function ecosystemDefines(text: string, key: string): boolean {
  return new RegExp(`^\\s*${key}\\s*:\\s*(?:'(?:[^'\\\\\\n]|\\\\.)*'|"(?:[^"\\\\\\n]|\\\\.)*")`, 'm').test(text);
}

/** The settings of <root>/.env; undefined when it cannot be read. */
function readPlatformEnv(root: string): Map<string, string> | undefined {
  try {
    return parseEnvDocument(readFileSync(join(root, '.env'), 'utf8')).values;
  } catch {
    return undefined;
  }
}

/**
 * Single source for console auth settings (#686, #699): a non-empty value in
 * <MCCTL_ROOT>/.env wins over the process env ONLY when ecosystem.config.cjs does
 * not define that key. While the ecosystem defines it, its (env) value is kept and
 * a differing .env value only triggers a warning (key name only).
 */
export function applyPlatformAuthEnv(env: Record<string, string | undefined> = process.env): void {
  const root = env.MCCTL_ROOT;
  if (!root) return;
  const values = readPlatformEnv(root);
  if (!values) return;
  let eco = '';
  try {
    eco = readFileSync(join(root, 'ecosystem.config.cjs'), 'utf8');
  } catch {
    // missing/unreadable = not defined
  }
  for (const key of KEYS) {
    const value = values.get(key);
    if (!value) continue;
    if (!ecosystemDefines(eco, key)) {
      env[key] = value;
    } else if (value !== env[key]) {
      console.warn(`[mcctl-console] ${key} is set in .env but ecosystem.config.cjs still defines it and wins; run \`mcctl upgrade\` to move it into .env.`);
    }
  }
}
