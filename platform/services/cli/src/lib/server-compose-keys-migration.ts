import { copyFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { serverLabelsOf } from '@minecraft-docker/shared';
import { atomicWriteFileSync } from '@minecraft-docker/shared/utils';

/** Server template keys mcctl upgrade adds to existing server composes that lack them. */
const KEYS = ['stop_grace_period', 'logging'];

export interface ComposeKeysMigrationResult {
  /** Servers whose docker-compose.yml got (or, in dry-run, would get) a missing template key or io.mcctl label. */
  updated: string[];
  /** Servers whose compose lacks one but could not be patched safely: set it by hand. */
  skipped: string[];
  /** Servers whose compose has no mem_limit (#662): not added here, mcctl migrate spec renders it. */
  noMemLimit: string[];
}

type ComposeDoc = { services?: Record<string, unknown> } | null;

const service = (text: string, name: string): Record<string, unknown> | undefined => {
  const svc = (yaml.load(text) as ComposeDoc)?.services?.[`mc-${name}`];
  return typeof svc === 'object' && svc !== null && !Array.isArray(svc) ? (svc as Record<string, unknown>) : undefined;
};

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isMapping = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** JSON with mapping keys sorted: equal for equal YAML, whatever the key order. */
const canonical = (v: unknown): string =>
  JSON.stringify(v, (_k, x: unknown) => (isMapping(x) ? Object.fromEntries(Object.entries(x).sort()) : x));

/** `entries` as block YAML lines at `indent` before offset `at` of `text`; undefined when the next key is not deeper than `parent`. */
function insertAt(text: string, at: number, parent: number, entries: Record<string, unknown>): string | undefined {
  const child = /^( +)[^\s#]/m.exec(text.slice(at));
  if (!child || child[1]!.length <= parent) return undefined;
  const block = yaml.dump(entries, { forceQuotes: true, quotingType: '"', lineWidth: -1 });
  return `${text.slice(0, at)}${block.replace(/^(?=.)/gm, child[1]!)}${text.slice(at)}`;
}

const serviceKey = (text: string, name: string) =>
  new RegExp(`^( *)(["']?)mc-${escape(name)}\\2:[ \\t]*(#.*)?\\n`, 'm').exec(text);

/** `text` with `entries` as the first keys of service mc-<name>; undefined when not block style. */
function insertKeys(text: string, name: string, entries: Record<string, unknown>): string | undefined {
  const key = serviceKey(text, name);
  return key ? insertAt(text, key.index + key[0].length, key[1]!.length, entries) : undefined;
}

/** `text` with `entries` first in the labels mapping of service mc-<name>; undefined when not block style. */
function insertLabels(text: string, name: string, entries: Record<string, unknown>): string | undefined {
  const key = serviceKey(text, name);
  if (!key) return undefined;
  const at = key.index + key[0].length;
  const indent = /^( +)[^\s#]/m.exec(text.slice(at))?.[1];
  if (indent === undefined || indent.length <= key[1]!.length) return undefined;
  const labels = new RegExp(`^${indent}labels:[ \\t]*(#.*)?\\n`, 'm').exec(text.slice(at));
  return labels ? insertAt(text, at + labels.index + labels[0].length, indent.length, entries) : undefined;
}

/**
 * Give every existing server the template keys it lacks, so its container
 * gets them when recreated: stop_grace_period (#661), log rotation (#662) and
 * the io.mcctl discovery labels (#674). A compose that already sets a key or
 * label keeps its value; labels written as a list are left alone (discovery
 * still finds the container through its compose project). Each changed file is copied to
 * docker-compose.yml.bak-<timestamp> first. Like the env_file migration
 * (#685), this edits the generated file: server.yaml does not change and
 * the renderer writes the same keys on the next render.
 */
export function migrateComposeKeys(root: string, templatesDir: string, dryRun: boolean): ComposeKeysMigrationResult {
  const result: ComposeKeysMigrationResult = { updated: [], skipped: [], noMemLimit: [] };
  const serversDir = join(root, 'servers');
  const templatePath = join(templatesDir, 'servers', '_template', 'docker-compose.yml');
  if (!existsSync(templatePath) || !existsSync(serversDir)) return result;
  const template = service(readFileSync(templatePath, 'utf-8'), 'template') ?? {};
  const wanted = KEYS.filter((k) => template[k] !== undefined);

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
      if (current && current['mem_limit'] === undefined) result.noMemLimit.push(name);
      const missing = wanted.filter((k) => current?.[k] === undefined);
      const labels = current?.['labels'];
      const missingLabels = isMapping(labels)
        ? Object.fromEntries(Object.entries(serverLabelsOf(name)).filter(([k]) => labels[k] === undefined))
        : {};
      if (current && missing.length === 0 && Object.keys(missingLabels).length === 0) continue;
      updated = missing.length ? insertKeys(content, name, Object.fromEntries(missing.map((k) => [k, template[k]]))) : content;
      if (updated !== undefined && Object.keys(missingLabels).length) updated = insertLabels(updated, name, missingLabels);
      // Written only when the whole file reads back as the old one plus the added keys and labels
      const want = yaml.load(content) as { services: Record<string, Record<string, unknown>> };
      const svc = want.services[`mc-${name}`]!;
      for (const k of missing) svc[k] = template[k];
      if (isMapping(svc['labels'])) Object.assign(svc['labels'], missingLabels);
      if (updated === undefined || canonical(yaml.load(updated)) !== canonical(want)) updated = undefined;
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
