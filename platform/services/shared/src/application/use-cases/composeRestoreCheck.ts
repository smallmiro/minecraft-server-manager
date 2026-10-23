import * as yaml from 'js-yaml';

/** Environment keys that decide a server's world; compose `environment` beats config.env. */
const WORLD_KEYS = new Set(['LEVEL', 'WORLD_NAME', 'EXTRA_ARGS']);
/** Container paths whose host mapping decides where worlds live. */
const WORLD_TARGETS = new Set(['/worlds', '/data']);

interface ServiceShape {
  env_file?: string | Array<string | { path?: string }>;
  environment?: Record<string, unknown> | string[];
  volumes?: Array<string | { source?: string; target?: string }>;
}

/**
 * World-relevant settings of a compose file: environment world keys, the
 * /worlds and /data mappings, and the env_file list in order (the assignment
 * adapter assumes ../global.env, then config.env, to resolve EXTRA_ARGS).
 */
function worldSettings(text: string): { keys: string[]; mounts: string; envFiles: string } {
  const doc = (yaml.load(text) ?? {}) as { services?: Record<string, ServiceShape> };
  const keys: string[] = [];
  const mounts: string[] = [];
  const envFiles: string[] = [];
  for (const [name, service] of Object.entries(doc.services ?? {})) {
    const files = service?.env_file === undefined ? [] : [service.env_file].flat();
    envFiles.push(`${name}:${files.map((f) => (typeof f === 'string' ? f : f.path ?? '')).join(',')}`);
    const env = service?.environment ?? {};
    const envKeys = Array.isArray(env) ? env.map((e) => String(e).split('=')[0]!.trim()) : Object.keys(env);
    keys.push(...envKeys.filter((k) => WORLD_KEYS.has(k)));
    for (const volume of service?.volumes ?? []) {
      const [source, target] =
        typeof volume === 'string' ? volume.split(':') : [volume.source ?? '', volume.target ?? ''];
      const path = (target ?? '').replace(/\/+$/, '');
      if (WORLD_TARGETS.has(path)) mounts.push(`${name}:${source}:${path}`);
    }
  }
  return { keys, mounts: mounts.sort().join('\n'), envFiles: envFiles.sort().join('\n') };
}

/**
 * Why restoring `restored` over `current` (docker-compose.yml) could move a
 * server's world past the assignment checks, or null (#670). Kept simple:
 * world keys in `environment`, any change of the /worlds or /data mapping
 * and any change of the env_file list or order are refused; so is a file
 * that cannot be parsed.
 */
export function composeRestoreRefusal(current: string, restored: string): string | null {
  try {
    const next = worldSettings(restored);
    if (next.keys.length > 0) {
      return `its environment sets ${[...new Set(next.keys)].join(', ')}; set the world in config.env instead`;
    }
    const now = worldSettings(current);
    if (now.mounts !== next.mounts) {
      return 'its /worlds or /data volume mapping differs from the current one';
    }
    if (now.envFiles !== next.envFiles) {
      return 'its env_file list (or order) differs from the current one';
    }
    return null;
  } catch (error) {
    return `it cannot be parsed (${error instanceof Error ? error.message : String(error)})`;
  }
}
