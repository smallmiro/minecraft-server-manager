/**
 * Docker adapters for the runtime ports (ADR-0001).
 *
 * Bodies moved verbatim from the legacy docker facade (src/docker), which now delegates here.
 * Never import the facade from this module: the facade imports this file (cycle).
 */
import { execSync, execFileSync, spawnSync } from 'node:child_process';
import type { ContainerStatus, HealthStatus, ContainerStats, PlayerListResult } from '../../types/index.js';
import { resolveMcctlRoot } from '../../utils/index.js';
import { execCommand, execCommandAsync } from '../process.js';
import type { IRouterStatusPort } from '../../application/ports/outbound/IRouterStatusPort.js';
import type { IPlayitAgentPort } from '../../application/ports/outbound/IPlayitAgentPort.js';
import type { IRuntimeEnvironmentPort, ToolVersion } from '../../application/ports/outbound/IRuntimeEnvironmentPort.js';

/**
 * Get container status
 */
function getContainerStatus(container: string): ContainerStatus {
  const result = execCommand('docker', [
    'inspect',
    '--format',
    '{{.State.Status}}',
    '--',
    container,
  ]);

  if (!result) return 'not_found';
  return result as ContainerStatus;
}

/**
 * Parse `rcon-cli list` output into a player list.
 * Strips ANSI escape codes (full and partial like `[0m`) and uses the first line only.
 * Returns null when the output does not match the player-count format.
 */
export function parseRconPlayerList(raw: string): PlayerListResult | null {
  // Strip ANSI escape codes and get first line only
  const result = raw
    .replace(/\x1b\[[0-9;]*m/g, '') // Remove ANSI codes
    .replace(/\[\d*m/g, '')         // Remove partial ANSI codes like [0m
    .split('\n')[0]                  // Get first line only
    ?.trim() ?? '';

  // Parse: "There are 3 of a max of 20 players online: Notch, Steve, Alex"
  // Or: "There are 0 of a max of 20 players online:"
  const countMatch = result.match(/There are (\d+)(?:\s+of a max of\s+|\/)(\d+) players? online/i);
  if (!countMatch || !countMatch[1] || !countMatch[2]) return null;

  const online = parseInt(countMatch[1], 10);
  const max = parseInt(countMatch[2], 10);

  // Extract player names after the colon (none when online is 0, so leftovers never become fake players)
  const playersMatch = result.match(/:\s*(.*)$/);
  let players: string[] = [];
  if (online > 0 && playersMatch && playersMatch[1]) {
    players = playersMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return { online, max, players };
}

/**
 * IContainerRuntimePort over the Docker CLI. Names are Docker container names (`mc-<server>`).
 */
export class DockerComposeRuntimeAdapter {
  getStatus(container: string): ContainerStatus {
    return getContainerStatus(container);
  }

  /**
   * Get container health status
   */
  getHealth(container: string): HealthStatus {
    const result = execCommand('docker', [
      'inspect',
      '--format',
      '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}',
      '--',
      container,
    ]);

    if (!result) return 'unknown';
    return result as HealthStatus;
  }

  /**
   * Check if container exists
   */
  exists(container: string): boolean {
    try {
      execFileSync('docker', ['inspect', '--', container], { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get minecraft server containers (mc-* except mc-router), all or running only
   */
  list(options?: { running?: boolean }): string[] {
    const result = options?.running
      ? execCommand('docker', [
          'ps',
          '--filter',
          'name=mc-',
          '--filter',
          'status=running',
          '--format',
          '{{.Names}}',
        ])
      : execCommand('docker', [
          'ps',
          '-a',
          '--filter',
          'name=mc-',
          '--format',
          '{{.Names}}',
        ]);

    if (!result) return [];

    return result
      .split('\n')
      .filter(name => name && name !== 'mc-router')
      .sort();
  }

  /**
   * Get container logs
   */
  getLogs(container: string, lines: number = 50): string {
    return execCommand('docker', ['logs', '--tail', String(lines), '--', container]);
  }

  /**
   * Get container resource stats (memory, CPU)
   */
  getStats(container: string): ContainerStats | null {
    // docker stats --no-stream --format "{{.MemUsage}},{{.CPUPerc}}"
    // Example output: "2.1GiB / 4GiB,15.23%"
    const result = execCommand('docker', [
      'stats',
      '--no-stream',
      '--format',
      '{{.MemUsage}},{{.CPUPerc}}',
      '--',
      container,
    ]);

    if (!result) return null;

    try {
      const [memUsage, cpuPerc] = result.split(',');
      if (!memUsage || !cpuPerc) return null;

      // Parse memory: "2.1GiB / 4GiB" or "512MiB / 4GiB"
      const memParts = memUsage.split('/').map((s) => s.trim());
      if (memParts.length !== 2) return null;

      const parseMemory = (mem: string): number => {
        const match = mem.match(/^([\d.]+)\s*(B|KiB|MiB|GiB|TiB|KB|MB|GB|TB)?$/i);
        if (!match || !match[1]) return 0;
        const value = parseFloat(match[1]);
        const unit = (match[2] ?? 'B').toUpperCase();
        const multipliers: Record<string, number> = {
          B: 1,
          KIB: 1024,
          MIB: 1024 ** 2,
          GIB: 1024 ** 3,
          TIB: 1024 ** 4,
          KB: 1000,
          MB: 1000 ** 2,
          GB: 1000 ** 3,
          TB: 1000 ** 4,
        };
        return value * (multipliers[unit] || 1);
      };

      const memoryUsage = parseMemory(memParts[0]!);
      const memoryLimit = parseMemory(memParts[1]!);
      const memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;

      // Parse CPU: "15.23%" or "0.00%"
      const cpuPercent = parseFloat(cpuPerc.replace('%', '')) || 0;

      return {
        memoryUsage,
        memoryLimit,
        memoryPercent,
        cpuPercent,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get container uptime (time since start)
   */
  getUptime(container: string): { uptime: string; seconds: number } | null {
    // docker inspect --format '{{.State.StartedAt}}'
    const result = execCommand('docker', [
      'inspect',
      '--format',
      '{{.State.StartedAt}}',
      '--',
      container,
    ]);

    if (!result || result === '0001-01-01T00:00:00Z') return null;

    try {
      const startedAt = new Date(result);
      const now = new Date();
      const diffMs = now.getTime() - startedAt.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);

      // Format uptime
      const days = Math.floor(diffSeconds / 86400);
      const hours = Math.floor((diffSeconds % 86400) / 3600);
      const minutes = Math.floor((diffSeconds % 3600) / 60);

      let uptime = '';
      if (days > 0) uptime += `${days}d `;
      if (hours > 0 || days > 0) uptime += `${hours}h `;
      uptime += `${minutes}m`;

      return { uptime: uptime.trim(), seconds: diffSeconds };
    } catch {
      return null;
    }
  }

  /**
   * Start a container
   * @deprecated No production caller; use start() (ADR-0001). Removed in D3/D4.
   */
  startContainer(container: string): boolean {
    try {
      execFileSync('docker', ['start', '--', container], { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Stop a container
   * @deprecated Use stop() (ADR-0001). Removed once its callers move (D2).
   */
  stopContainer(container: string): boolean {
    try {
      execFileSync('docker', ['stop', '--', container], { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * IServerConsolePort over `docker exec <container> rcon-cli`.
 */
export class DockerServerConsoleAdapter {
  /**
   * Get online players via RCON
   */
  async listPlayers(container: string): Promise<PlayerListResult | null> {
    try {
      const rawResult = execFileSync('docker', ['exec', '--', container, 'rcon-cli', 'list'], {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return parseRconPlayerList(rawResult);
    } catch {
      return null;
    }
  }
}

export class DockerRouterStatusAdapter implements IRouterStatusPort {
  /**
   * Check mc-router health via management API
   * mc-router uses distroless image, so Docker healthcheck doesn't work
   * Instead, we check the management API on localhost:25580
   */
  getHealth(): HealthStatus {
    try {
      // Check if mc-router is running first
      const status = getContainerStatus('mc-router');
      if (status !== 'running') {
        return 'unknown';
      }

      // Try to connect to management API
      const result = spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', 'http://127.0.0.1:25580/routes'], {
        encoding: 'utf-8',
        timeout: 3000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (result.error || result.status !== 0) {
        // curl failed, try wget
        const wgetResult = spawnSync('wget', ['-q', '-O', '/dev/null', 'http://127.0.0.1:25580/routes'], {
          encoding: 'utf-8',
          timeout: 3000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        if (wgetResult.error || wgetResult.status !== 0) {
          return 'unhealthy';
        }
        return 'healthy';
      }

      const httpCode = (result.stdout ?? '').trim();
      if (httpCode === '200') {
        return 'healthy';
      }
      return 'unhealthy';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get container's hostname label (mc-router.host)
   */
  getHostnames(container: string): string {
    const result = execCommand('docker', [
      'inspect',
      '--format',
      '{{index .Config.Labels "mc-router.host"}}',
      '--',
      container,
    ]);

    return result || '-';
  }
}

/**
 * playit-agent container via docker compose with the playit profile.
 * `root` defaults to resolveMcctlRoot() at call time.
 */
export class DockerPlayitAgentAdapter implements IPlayitAgentPort {
  constructor(private readonly options: { root?: string } = {}) {}

  /**
   * Start playit-agent container
   */
  async start(): Promise<{ success: boolean; error?: string }> {
    const platformRoot = this.options.root ?? resolveMcctlRoot();

    try {
      const result = await execCommandAsync('docker', [
        'compose',
        '--profile',
        'playit',
        'up',
        '-d',
        'playit',
      ], { cwd: platformRoot });

      if (result.code === 0) {
        return { success: true };
      }
      return { success: false, error: result.stderr || result.stdout };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  /**
   * Stop playit-agent container
   */
  async stop(): Promise<boolean> {
    const platformRoot = this.options.root ?? resolveMcctlRoot();

    try {
      const result = await execCommandAsync('docker', [
        'compose',
        '--profile',
        'playit',
        'stop',
        'playit',
      ], { cwd: platformRoot });

      return result.code === 0;
    } catch {
      return false;
    }
  }
}

export class DockerRuntimeEnvironmentAdapter implements IRuntimeEnvironmentPort {
  /**
   * Check if Docker is available
   */
  isAvailable(): boolean {
    try {
      execSync('docker info', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if Docker Compose is available
   * @deprecated No caller (ADR-0001). Removed in D3/D4.
   */
  isComposeAvailable(): boolean {
    try {
      execSync('docker compose version', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Docker version
   */
  getEngineVersion(): ToolVersion {
    try {
      const result = execSync('docker version --format {{.Server.Version}}', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      return { installed: true, version: result || undefined };
    } catch {
      return { installed: false };
    }
  }

  /**
   * Get Docker Compose version
   */
  getComposeVersion(): ToolVersion {
    try {
      const result = execSync('docker compose version --short', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      // Remove leading 'v' if present
      const version = result.replace(/^v/, '');
      return { installed: true, version: version || undefined };
    } catch {
      return { installed: false };
    }
  }
}
