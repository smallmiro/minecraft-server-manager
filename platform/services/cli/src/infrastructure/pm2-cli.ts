/**
 * pm2 processes run by the console commands (pm2 probe, `pm2 logs`).
 * Not runtime-port work (ADR-0001 row 16).
 */
import { spawn, spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { delimiter, dirname, join } from 'node:path';

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

/**
 * Make PM2 come back at boot (#650): `pm2 startup` writes a systemd unit
 * (Linux) or launchd agent (macOS) that runs `pm2 resurrect`, then `pm2 save`
 * records the running apps for it. startup needs root, so it runs through
 * sudo unless mcctl is root (`-n` without a terminal: NOPASSWD or cached
 * credentials only). PATH starts with the directory of the Node.js running
 * mcctl, so pm2 and the unit it writes use that Node, the one better-sqlite3
 * was built for. `--hp` points the unit at PM2_HOME (default ~/.pm2).
 * Returns the step that failed and the command to show the user.
 */
export function enablePm2Startup(
  pm2Path: string,
  interactive: boolean
): { failed?: 'startup' | 'save'; command: string } {
  const pm2Home = process.env.PM2_HOME;
  const path = `PATH=${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ''}`;
  const startup = ['env', path, pm2Path, 'startup', '-u', userInfo().username, '--hp', pm2Home ? dirname(pm2Home) : homedir()];
  const isRoot = process.getuid?.() === 0;
  const save = [pm2Path, 'save'];
  const command = [...(isRoot ? [] : ['sudo']), 'env', `'${path}'`, ...startup.slice(2), '&&', ...save].join(' ');

  const run = ([cmd, ...args]: string[]) => {
    const result = spawnSync(cmd!, args, { stdio: 'inherit' });
    return !result.error && result.status === 0;
  };
  if (!run(isRoot ? startup : ['sudo', ...(interactive ? [] : ['-n']), ...startup])) {
    return { failed: 'startup', command };
  }
  if (!run(save)) return { failed: 'save', command: save.join(' ') };
  return { command };
}
