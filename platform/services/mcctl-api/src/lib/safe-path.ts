import { resolve, sep } from 'node:path';

/**
 * Resolve `name` under `base`, or null when the result is `base` itself or
 * outside it ('..', absolute paths, ...). Last line of defense for user- or
 * config-supplied names that become file paths (#720).
 */
export function resolveInside(base: string, name: string): string | null {
  const root = resolve(base);
  const target = resolve(root, name);
  return target.startsWith(root + sep) ? target : null;
}
