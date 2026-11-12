/**
 * pm2 processes run by the console commands (pm2 probe, `pm2 logs`).
 * Not runtime-port work (ADR-0001 row 16).
 */
import { spawn, spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';

/**
 * The pm2 binary on PATH, if any. The bundled pm2 module serves the
 * programmatic API without it, but `pm2 logs` and `pm2 startup` need it.
 */
export function checkPm2Installation(): { installed: boolean; path?: string; version?: string } {
  const pm2Path = (process.env.PATH ?? '')
    .split(delimiter)
    .filter(Boolean)
    .map((dir) => join(dir, 'pm2'))
    .find((candidate) => {
      try {
        accessSync(candidate, constants.X_OK);
        return true;
      } catch {
        return false;
      }
    });
  if (!pm2Path) return { installed: false };

  const version = spawnSync(pm2Path, ['--version'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  return {
    installed: true,
    path: pm2Path,
    version: version.status === 0 ? version.stdout.trim() : undefined,
  };
}

/** `pm2 logs <services>` with inherited stdio until it exits; Ctrl+C is passed on. */
export function followPm2Logs(services: string[]): Promise<number> {
  return new Promise((resolve) => {
    const args = ['logs', ...services];

    const proc = spawn('pm2', args, {
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      resolve(code ?? 0);
    });

    // pm2 missing from PATH (ENOENT) or not executable: no 'close' follows
    proc.on('error', (error) => {
      console.error(`Failed to run pm2: ${error.message}`);
      resolve(1);
    });

    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      proc.kill('SIGINT');
    });
  });
}
