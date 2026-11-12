import { copyFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { atomicWriteFileSync } from '@minecraft-docker/shared/utils';

/** Server template keys mcctl upgrade adds to existing server composes that lack them. */
const KEYS = ['stop_grace_period'];

export interface ComposeKeysMigrationResult {
  /** Servers whose docker-compose.yml got (or, in dry-run, would get) a missing template key. */
  updated: string[];
  /** Servers whose compose lacks one but could not be patched safely: set it by hand. */
  skipped: string[];
}

type ComposeDoc = { services?: Record<string, unknown> } | null;

const service = (text: string, name: string): Record<string, unknown> | undefined => {
  const svc = (yaml.load(text) as ComposeDoc)?.services?.[`mc-${name}`];
  return typeof svc === 'object' && svc !== null && !Array.isArray(svc) ? (svc as Record<string, unknown>) : undefined;
};

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `text` with `entries` as the first keys of service mc-<name>; undefined when not block style. */
function insertKeys(text: string, name: string, entries: Record<string, unknown>): string | undefined {
  const key = new RegExp(`^( *)(["']?)mc-${escape(name)}\\2:[ \\t]*(#.*)?\\n`, 'm').exec(text);
  if (!key) return undefined;
  const at = key.index + key[0].length;
  const child = /^( +)[^\s#]/m.exec(text.slice(at));
  if (!child || child[1]!.length <= key[1]!.length) return undefined;
  const block = yaml.dump(entries, { forceQuotes: true, quotingType: '"', lineWidth: -1 });
  return `${text.slice(0, at)}${block.replace(/^(?=.)/gm, child[1]!)}${text.slice(at)}`;
}

/**
 * Give every existing server the template keys it lacks (#661), so its
 * container gets them when recreated. A compose that already sets a key
 * keeps its value. Each changed file is copied to
 * docker-compose.yml.bak-<timestamp> first. Like the env_file migration
 * (#685), this edits the generated file: server.yaml does not change and
 * the renderer writes the same keys on the next render.
 */
export function migrateComposeKeys(root: string, templatesDir: string, dryRun: boolean): ComposeKeysMigrationResult {
  const result: ComposeKeysMigrationResult = { updated: [], skipped: [] };
  const serversDir = join(root, 'servers');
  const templatePath = join(templatesDir, 'servers', '_template', 'docker-compose.yml');
  if (!existsSync(templatePath) || !existsSync(serversDir)) return result;
  const template = service(readFileSync(templatePath, 'utf-8'), 'template') ?? {};
  const wanted = KEYS.filter((k) => template[k] !== undefined);
  if (wanted.length === 0) return result;

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
      const current = service(content, name);
      const missing = wanted.filter((k) => current?.[k] === undefined);
      if (current && missing.length === 0) continue;
      updated = insertKeys(content, name, Object.fromEntries(missing.map((k) => [k, template[k]])));
      // Written only when the result reads back as intended
      const after = updated === undefined ? undefined : service(updated, name);
      if (!after || missing.some((k) => JSON.stringify(after[k]) !== JSON.stringify(template[k]))) updated = undefined;
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
