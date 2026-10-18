import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnvDocument } from '@minecraft-docker/shared/utils';

const KEYS = ['BETTER_AUTH_SECRET', 'BETTER_AUTH_BASE_URL'];

/**
 * Single source for console auth settings (#686): a non-empty value in
 * <MCCTL_ROOT>/.env wins over the PM2 env (older ecosystem files inject these)
 * and over a .env bundled into the standalone build. Otherwise the env is kept.
 */
export function applyPlatformAuthEnv(env: Record<string, string | undefined> = process.env): void {
  const root = env.MCCTL_ROOT;
  if (!root) return;
  let content: string;
  try {
    content = readFileSync(join(root, '.env'), 'utf8');
  } catch {
    return;
  }
  const { values } = parseEnvDocument(content);
  for (const key of KEYS) {
    const value = values.get(key);
    if (value) env[key] = value;
  }
}
