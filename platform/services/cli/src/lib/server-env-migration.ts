import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWriteFileSync } from '@minecraft-docker/shared/utils';

/** env_file entry that injected the whole platform .env into a server container. */
const LEGACY_ENV_FILE_RE = /^(\s*-\s*)\.\.\/\.\.\/\.env[ \t]*$/gm;

export interface ServerEnvMigrationResult {
  createdGlobalEnv: boolean;
  /** Servers whose docker-compose.yml was (or, in dry-run, would be) repointed. */
  migrated: string[];
}

/**
 * Stop leaking platform secrets into server containers (#685): create
 * servers/global.env when missing, then replace the `- ../../.env` env_file
 * entry of every existing server with `- ../global.env`. A customized
 * global.env and _template (synced separately) are left alone.
 */
export function migrateServerEnv(root: string, templatesDir: string, dryRun: boolean): ServerEnvMigrationResult {
  const serversDir = join(root, 'servers');
  const globalEnv = join(serversDir, 'global.env');
  const bundledGlobalEnv = join(templatesDir, 'servers', 'global.env');
  const result: ServerEnvMigrationResult = { createdGlobalEnv: false, migrated: [] };

  // Without global.env the repointed compose files would fail to load.
  if (!existsSync(bundledGlobalEnv)) return result;

  if (!existsSync(globalEnv)) {
    if (!dryRun) {
      mkdirSync(serversDir, { recursive: true });
      copyFileSync(bundledGlobalEnv, globalEnv);
    }
    result.createdGlobalEnv = true;
  }

  if (!existsSync(serversDir)) return result;
  for (const entry of readdirSync(serversDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === '_template' || entry.name.startsWith('.')) continue;
    const composePath = join(serversDir, entry.name, 'docker-compose.yml');
    if (!existsSync(composePath)) continue;
    const content = readFileSync(composePath, 'utf-8');
    const updated = content.replace(LEGACY_ENV_FILE_RE, '$1../global.env');
    if (updated === content) continue;
    if (!dryRun) atomicWriteFileSync(composePath, updated);
    result.migrated.push(entry.name);
  }
  return result;
}
