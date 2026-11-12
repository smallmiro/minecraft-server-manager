import yaml from 'js-yaml';
import { composeMap } from './importDockerServer.js';

const isMapping = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Dotted paths where `a` and `b` differ (mappings by key, everything else as a whole). */
function diff(a: unknown, b: unknown, path: string): string[] {
  if (isMapping(a) && isMapping(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    return keys.flatMap((k) => diff(a[k], b[k], path ? `${path}.${k}` : k));
  }
  return JSON.stringify(a) === JSON.stringify(b) ? [] : [path || '(root)'];
}

/** Labels the spec owns: mc-router routing, and the mcctl discovery labels (#674; absent before it). */
const specLabel = (key: string) => key.startsWith('mc-router.') || key.startsWith('io.mcctl.');
const specLabels = (labels: Map<string, string | null>, owned: boolean) =>
  Object.fromEntries([...labels].filter(([k]) => specLabel(k) === owned));

/**
 * The YAML paths where a server compose differs from the rendered one
 * outside the spec-owned fields (ADR-0003 §3). Spec-owned fields (image,
 * mc-router and io.mcctl labels) and known legacy variants (env_file ../../.env, #685;
 * no stop_grace_period, #661; no logging or mem_limit, #662) do not count. `environmentMoved`: the compose environment was moved into
 * the spec (import), so only EULA is compared.
 */
export function composeOutsideEdits(
  name: string,
  currentText: string,
  renderedText: string,
  environmentMoved: boolean
): string[] {
  let current: Record<string, unknown>;
  try {
    current = yaml.load(currentText) as Record<string, unknown>;
  } catch {
    return ['(the file does not parse as YAML)'];
  }
  const rendered = yaml.load(renderedText) as { services: Record<string, Record<string, unknown>> };
  const service = `mc-${name}`;
  const ours = rendered.services[service]!;
  ours['environment'] = Object.fromEntries(composeMap(ours['environment']));

  const services = isMapping(current) ? current['services'] : undefined;
  const theirs = isMapping(services) ? services[service] : undefined;
  if (isMapping(theirs)) {
    theirs['image'] = ours['image'];
    const labels = composeMap(theirs['labels']);
    theirs['labels'] = { ...specLabels(labels, false), ...specLabels(composeMap(ours['labels']), true) };
    const environment = composeMap(theirs['environment']);
    theirs['environment'] = environmentMoved
      ? Object.fromEntries([...environment].filter(([k]) => k === 'EULA'))
      : Object.fromEntries(environment);
    if (Array.isArray(theirs['env_file'])) {
      theirs['env_file'] = theirs['env_file'].map((f: unknown) => (f === '../../.env' ? '../global.env' : f));
    }
    theirs['stop_grace_period'] ??= ours['stop_grace_period'];
    theirs['logging'] ??= ours['logging'];
    theirs['mem_limit'] ??= ours['mem_limit'];
  }
  return diff(current, rendered, '');
}

/**
 * Whether a write rendering `next` instead of `before` may leave a server
 * compose with edits outside the spec (`current`) as it is: the renders are
 * equal, or differ only in mem_limit and `current` has none (written before
 * #662, so no limit stays no limit). A compose that has a mem_limit is not
 * left behind: its old limit could be below a new heap.
 */
export function writeLeavesCompose(name: string, current: string, before: string, next: string): boolean {
  if (before === next) return true;
  const service = `mc-${name}`;
  const withoutLimit = (text: string): string => {
    const doc = yaml.load(text) as { services: Record<string, Record<string, unknown>> };
    delete doc.services[service]!['mem_limit'];
    return JSON.stringify(doc);
  };
  try {
    const services = (yaml.load(current) as { services?: unknown } | null)?.services;
    const theirs = isMapping(services) ? services[service] : undefined;
    return isMapping(theirs) && theirs['mem_limit'] === undefined && withoutLimit(before) === withoutLimit(next);
  } catch {
    return false;
  }
}
