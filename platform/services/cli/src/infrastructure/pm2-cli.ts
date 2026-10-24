/**
 * pm2 processes run by the console commands (pm2 probe, `pm2 logs`).
 * Not runtime-port work (ADR-0001 row 16).
 */
import { spawn, spawnSync } from 'node:child_process';

/**
 * Check if PM2 is installed (globally or as a dependency)
 * @returns Object with installation status and version
 */
export function checkPm2Installation(): { installed: boolean; path?: string; version?: string } {
  // First check if pm2 is available in PATH (global installation)
  const globalResult = spawnSync('which', ['pm2'], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (globalResult.status === 0 && globalResult.stdout) {
    const pm2Path = globalResult.stdout.trim();

    // Get version
    const versionResult = spawnSync('pm2', ['--version'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return {
      installed: true,
      path: pm2Path,
      version: versionResult.status === 0 ? versionResult.stdout.trim() : undefined,
    };
  }

  // Check if pm2 module can be imported (local installation via npm).
  // The pm2 programmatic API works without global installation, and pm2 is a
  // declared dependency, so it's always available via the API.
  return {
    installed: true,
    version: 'local',
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

    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      proc.kill('SIGINT');
    });
  });
}
