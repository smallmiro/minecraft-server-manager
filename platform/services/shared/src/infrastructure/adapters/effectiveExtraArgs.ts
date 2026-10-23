import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Paths } from '../../utils/index.js';
import { parseEnvDocument, type EnvDocument } from '../../utils/env-file.js';

/**
 * How a server's effective EXTRA_ARGS (and so where its world lives) is
 * resolved (ADR-0002). One copy for the world assignment adapter (#670) and
 * the ServerSpec import (#675, ADR-0003), so both read a server the same way.
 */

/** Inherited EXTRA_ARGS: a value, none, or unreadable (the servers relying on it are undetermined). */
export type InheritedExtraArgs = string | undefined | Error;

/**
 * Whether the effective (last) `KEY=` line is subject to Compose
 * interpolation: unquoted and double-quoted values are, single-quoted ones
 * are literal. Such a value has no fixed name, so it is undetermined (R7).
 */
export function isInterpolated(doc: EnvDocument, key: string): boolean {
  const line = [...doc.lines].reverse().find((l) => l.key === key);
  if (!line) return false;
  const raw = line.raw.slice(line.raw.indexOf('=') + 1).trim();
  return !raw.startsWith("'") && raw.includes('$');
}

/**
 * Where --universe puts worlds: 'worlds' for /worlds, 'internal' for none or
 * /data (the container's working directory), undefined for anything else.
 */
export function universeLocation(extraArgs: string): 'worlds' | 'internal' | undefined {
  const args = extraArgs.trim().split(/\s+/).filter(Boolean);
  const i = args.findIndex((a) => a === '--universe' || a.startsWith('--universe='));
  if (i < 0) return 'internal';
  const value = args[i]!.startsWith('--universe=') ? args[i]!.slice('--universe='.length) : args[i + 1];
  if (!value || value.includes('$')) return undefined;
  const path = value.replace(/\/+$/, '') || '/';
  if (path === '/worlds') return 'worlds';
  if (path === '/data' || path === '.' || path === './') return 'internal';
  return undefined;
}

/**
 * EXTRA_ARGS a server gets from servers/global.env (a bare `EXTRA_ARGS` line
 * takes the platform .env value). `dotenvOverride` replaces the .env content.
 */
export async function readInheritedExtraArgs(paths: Paths, dotenvOverride?: string): Promise<InheritedExtraArgs> {
  const read = async (file: string): Promise<string | undefined> => {
    try {
      return await readFile(file, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw err;
    }
  };
  try {
    const global = await read(join(paths.servers, 'global.env'));
    if (global === undefined) return undefined;
    const doc = parseEnvDocument(global);
    if (doc.values.has('EXTRA_ARGS')) {
      return isInterpolated(doc, 'EXTRA_ARGS') ? new Error('interpolated') : doc.values.get('EXTRA_ARGS');
    }
    if (!/^\s*EXTRA_ARGS\s*$/m.test(global)) return undefined;
    const dotenv = dotenvOverride ?? (await read(paths.envFile));
    // A bare key with no platform value leaves the variable unset.
    if (dotenv === undefined) return undefined;
    const dotenvDoc = parseEnvDocument(dotenv);
    // Compose interpolates .env values too: such a value has no fixed location (R7)
    return isInterpolated(dotenvDoc, 'EXTRA_ARGS') ? new Error('interpolated') : dotenvDoc.values.get('EXTRA_ARGS');
  } catch (err) {
    return err as Error;
  }
}
