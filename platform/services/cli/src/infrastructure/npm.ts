/**
 * npm runner for `mcctl update` and `mcctl console init`.
 * Not runtime-port work (ADR-0001 row 16).
 */
import { spawnSync, type SpawnSyncReturns } from 'child_process';

/** Run `npm <args>` (no shell) with piped output, optionally in `cwd`. */
export function runNpm(args: string[], cwd?: string): SpawnSyncReturns<string> {
  return spawnSync('npm', args, {
    ...(cwd ? { cwd } : {}),
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}
