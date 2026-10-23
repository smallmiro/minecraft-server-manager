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

const routerLabels = (labels: Map<string, string | null>) =>
  Object.fromEntries([...labels].filter(([k]) => k.startsWith('mc-router.')));

/**
 * The YAML paths where a server compose differs from the rendered one
 * outside the spec-owned fields (ADR-0003 §3). Spec-owned fields (image,
 * mc-router labels) and known legacy variants (env_file ../../.env, #685)
 * do not count. `environmentMoved`: the compose environment was moved into
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
    theirs['labels'] = {
      ...Object.fromEntries([...labels].filter(([k]) => !k.startsWith('mc-router.'))),
      ...routerLabels(composeMap(ours['labels'])),
    };
    const environment = composeMap(theirs['environment']);
    theirs['environment'] = environmentMoved
      ? Object.fromEntries([...environment].filter(([k]) => k === 'EULA'))
      : Object.fromEntries(environment);
    if (Array.isArray(theirs['env_file'])) {
      theirs['env_file'] = theirs['env_file'].map((f: unknown) => (f === '../../.env' ? '../global.env' : f));
    }
  }
  return diff(current, rendered, '');
}
