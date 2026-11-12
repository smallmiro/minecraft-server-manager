import { copyFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { atomicWriteFileSync } from '@minecraft-docker/shared/utils';

export interface StopGraceMigrationResult {
  /** Servers whose docker-compose.yml got (or, in dry-run, would get) stop_grace_period. */
  updated: string[];
  /** Servers whose compose lacks it but could not be patched safely: set it by hand. */
  skipped: string[];
}

type ComposeDoc = { services?: Record<string, unknown> } | null;

const service = (text: string, name: string): Record<string, unknown> | undefined => {
  const svc = (yaml.load(text) as ComposeDoc)?.services?.[`mc-${name}`];
  return typeof svc === 'object' && svc !== null && !Array.isArray(svc) ? (svc as Record<string, unknown>) : undefined;
};

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `text` with `stop_grace_period: <value>` as the first key of service mc-<name>; undefined when not block style. */
function insertGrace(text: string, name: string, value: string): string | undefined {
  const key = new RegExp(`^( *)(["']?)mc-${escape(name)}\\2:[ \\t]*(#.*)?\\n`, 'm').exec(text);
  if (!key) return undefined;
  const at = key.index + key[0].length;
  const child = /^( +)[^\s#]/m.exec(text.slice(at));
  if (!child || child[1]!.length <= key[1]!.length) return undefined;
  return `${text.slice(0, at)}${child[1]}stop_grace_period: ${JSON.stringify(value)}\n${text.slice(at)}`;
}

/**
 * Give every existing server the template's stop_grace_period (#661), so
 * Docker waits for the world save instead of killing the server after 10s.
 * A compose that already sets one keeps its value. Each changed file is
 * copied to docker-compose.yml.bak-<timestamp> first. Like the env_file
 * migration (#685), this edits the generated file: server.yaml does not
 * change and the renderer writes the same key on the next render.
 */
export function migrateStopGrace(root: string, templatesDir: string, dryRun: boolean): StopGraceMigrationResult {
  const result: StopGraceMigrationResult = { updated: [], skipped: [] };
  const serversDir = join(root, 'servers');
  const templatePath = join(templatesDir, 'servers', '_template', 'docker-compose.yml');
  if (!existsSync(templatePath) || !existsSync(serversDir)) return result;
  const value = service(readFileSync(templatePath, 'utf-8'), 'template')?.['stop_grace_period'];
  if (typeof value !== 'string') return result;

  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const names = readdirSync(serversDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== '_template' && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
  for (const name of names) {
    const composePath = join(serversDir, name, 'docker-compose.yml');
    if (!existsSync(composePath)) continue;
    const content = readFileSync(composePath, 'utf-8');
    let updated: string | undefined;
    try {
      if (service(content, name)?.['stop_grace_period'] !== undefined) continue;
      updated = insertGrace(content, name, value);
      // Written only when the result reads back as intended
      if (updated !== undefined && service(updated, name)?.['stop_grace_period'] !== value) updated = undefined;
    } catch {
      updated = undefined;
    }
    if (updated === undefined) {
      result.skipped.push(name);
      continue;
    }
    if (!dryRun) {
      copyFileSync(composePath, `${composePath}.bak-${stamp}`);
      atomicWriteFileSync(composePath, updated);
    }
    result.updated.push(name);
  }
  return result;
}
