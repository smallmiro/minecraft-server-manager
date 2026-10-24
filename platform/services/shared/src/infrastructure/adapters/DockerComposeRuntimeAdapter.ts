/**
 * Docker adapters for the runtime ports (ADR-0001).
 *
 * Bodies moved verbatim from the legacy docker facade (src/docker), which now delegates here.
 * Never import the facade from this module: the facade imports this file (cycle).
 */
import { execSync, execFileSync, spawnSync, spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ContainerStatus, HealthStatus, ContainerStats, PlayerListResult } from '../../types/index.js';
import { resolveMcctlRoot } from '../../utils/index.js';
import { execCommand, execCommandAsync } from '../process.js';
import type { ServerName } from '../../domain/value-objects/ServerName.js';
import { workloadNameOf } from './workloadNames.js';
import type { IContainerRuntimePort, RuntimeActionResult } from '../../application/ports/outbound/IContainerRuntimePort.js';
import type {
  IServerConsolePort,
  ConsoleCommandResult,
  ConsoleEndpoint,
} from '../../application/ports/outbound/IServerConsolePort.js';
import type {
  IRouterStatusPort,
  RouterContainerConfig,
} from '../../application/ports/outbound/IRouterStatusPort.js';
import type { IPlayitAgentPort } from '../../application/ports/outbound/IPlayitAgentPort.js';
import type { IRuntimeEnvironmentPort, ToolVersion } from '../../application/ports/outbound/IRuntimeEnvironmentPort.js';

const execFilePromise = promisify(execFile);

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
 * IContainerRuntimePort over the Docker CLI. A ServerName maps to its container (`mc-<server>`, workloadNames.ts);
 * a string is the container name itself (deprecated v2 form, still used by the legacy facade).
 * `root` defaults to resolveMcctlRoot() at call time; `env` (default process.env) applies to start/stop/restart only.
 */
export class DockerComposeRuntimeAdapter implements IContainerRuntimePort {
  /**
   * @param options.startTimeoutMs how long `start` (docker compose up) may take; default 60 s.
   *   A first start can pull the image (#675: create passes a longer one).
   */
  constructor(
    private readonly options: { root?: string; env?: () => NodeJS.ProcessEnv; startTimeoutMs?: number } = {}
  ) {}

  getStatus(name: ServerName | string): ContainerStatus {
    const container = workloadNameOf(name);
    return getContainerStatus(container);
  }

  /**
   * Async `docker inspect` (the pre-#665 ServerRepository query, with `--`).
   * Non-zero exit → 'not_found'; otherwise the lower-cased state.
   */
  async getStatusAsync(name: ServerName | string): Promise<ContainerStatus> {
    const result = await execCommandAsync('docker', ['inspect', '-f', '{{.State.Status}}', '--', workloadNameOf(name)]);
    if (result.code !== 0) return 'not_found';
    return result.stdout.trim().toLowerCase() as ContainerStatus;
  }

  /**
   * Get container health status
   */
  getHealth(name: ServerName | string): HealthStatus {
    const container = workloadNameOf(name);
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
  exists(name: ServerName | string): boolean {
    const container = workloadNameOf(name);
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
  list(options?: { running?: boolean; strict?: boolean }): string[] {
    const args = options?.running
      ? ['ps', '--filter', 'name=mc-', '--filter', 'status=running', '--format', '{{.Names}}']
      : ['ps', '-a', '--filter', 'name=mc-', '--format', '{{.Names}}'];
    let result: string;
    if (options?.strict) {
      const r = spawnSync('docker', args, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      if (r.error || r.status !== 0) {
        throw new Error(`docker ps failed: ${r.error?.message ?? (r.stderr || `exit ${r.status}`).trim()}`);
      }
      result = (r.stdout ?? '').trim();
    } else {
      result = execCommand('docker', args);
    }

    if (!result) return [];

    return result
      .split('\n')
      .filter(name => name && name !== 'mc-router')
      .sort();
  }

  /**
   * Get container logs
   */
  getLogs(name: ServerName | string, lines: number = 50): string {
    const container = workloadNameOf(name);
    return execCommand('docker', ['logs', '--tail', String(lines), '--', container]);
  }

  /**
   * Get container resource stats (memory, CPU)
   */
  getStats(name: ServerName | string): ContainerStats | null {
    const container = workloadNameOf(name);
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
  getUptime(name: ServerName | string): { uptime: string; seconds: number } | null {
    const container = workloadNameOf(name);
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

  /** Create the container if missing, then run it (`docker compose up -d`) */
  start(name: ServerName | string): Promise<RuntimeActionResult> {
    const container = workloadNameOf(name);
    return this.compose(['compose', 'up', '-d', container], this.options.startTimeoutMs);
  }

  stop(name: ServerName | string): Promise<RuntimeActionResult> {
    const container = workloadNameOf(name);
    return this.run(['stop', '--', container], { env: this.env() });
  }

  restart(name: ServerName | string): Promise<RuntimeActionResult> {
    const container = workloadNameOf(name);
    return this.compose(['compose', 'restart', container]);
  }

  /**
   * delete-server.sh step 1 (#735): `docker ps -a` decides whether the
   * container exists; a container of the compose project is stopped and
   * removed with compose, any other with `docker rm -f`.
   */
  async remove(name: ServerName | string): Promise<RuntimeActionResult> {
    const container = workloadNameOf(name);
    const failed = (what: string, r: RuntimeActionResult): RuntimeActionResult => ({
      ...r,
      success: false,
      error: `Failed to ${what} container ${container}: ${r.error ?? 'unknown error'}`,
    });
    const ps = await this.run(['ps', '-a', '--format', '{{.Names}}'], { env: this.env() });
    if (!ps.success) return { ...ps, error: `Cannot list Docker containers (is Docker running?): ${ps.error}` };
    if (!ps.stdout?.split('\n').includes(container)) return { success: true, stdout: `Container ${container} not found` };

    const project = await this.compose(['compose', 'ps', container]);
    if (project.success && project.stdout?.includes(container)) {
      const stop = await this.compose(['compose', 'stop', container]);
      if (!stop.success) return failed('stop', stop);
      const rm = await this.compose(['compose', 'rm', '-f', container]);
      if (!rm.success) return failed('remove', rm);
      return { success: true, stdout: `Container ${container} stopped and removed` };
    }
    // Not in the compose project (e.g. its include entry is already gone)
    const rm = await this.run(['rm', '-f', '--', container], { env: this.env() });
    return rm.success ? { success: true, stdout: `Container ${container} removed` } : failed('remove', rm);
  }

  /** Copied from mcctl-api player-session-collector (defaultLogFetcher) */
  async readLogs(name: ServerName | string, options: { since: string; tail: number }): Promise<string[]> {
    const container = workloadNameOf(name);
    const { stdout } = await execFilePromise(
      'docker',
      ['logs', '--timestamps', '--since', options.since, '--tail', String(options.tail), '--', container],
      { timeout: 10_000, maxBuffer: 10 * 1024 * 1024 }
    );
    return stdout.split('\n').filter(Boolean);
  }

  /** Copied from mcctl-api GET /api/servers/:name/logs?follow; abort kills the child through spawn's signal */
  followLogs(
    name: ServerName | string,
    onChunk: (chunk: string) => void,
    signal: AbortSignal,
    options?: {
      tail?: number;
      follow?: boolean;
      onExit?: (code: number | null, error?: Error) => void;
    }
  ): Promise<void> {
    const container = workloadNameOf(name);
    return new Promise((resolve) => {
      const dockerLogs = spawn('docker', [
          'logs',
          ...(options?.follow === false ? [] : ['-f']),
          '--tail',
          String(options?.tail ?? 0),
          '--',
          container,
        ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        signal,
      });

      const send = (data: Buffer) => {
        if (!signal.aborted) onChunk(data.toString());
      };

      dockerLogs.stdout?.on('data', send);
      dockerLogs.stderr?.on('data', send);
      let exited = false;
      const finish = (code: number | null, error?: Error) => {
        if (!exited) {
          exited = true;
          options?.onExit?.(code, error);
        }
        resolve();
      };
      dockerLogs.on('close', (code: number | null) => finish(code));
      dockerLogs.on('error', (error: Error) => finish(null, error));
    });
  }

  private env(): NodeJS.ProcessEnv {
    return this.options.env?.() ?? process.env;
  }

  /** Copied from mcctl-api executeServerAction */
  private compose(args: string[], timeout = 60000): Promise<RuntimeActionResult> {
    return this.run(args, {
      cwd: this.options.root ?? resolveMcctlRoot(),
      timeout,
      // Ensure Docker Compose uses the correct compose file
      env: { ...this.env(), COMPOSE_FILE: 'docker-compose.yml' },
    });
  }

  private async run(
    args: string[],
    options: { cwd?: string; timeout?: number; env: NodeJS.ProcessEnv }
  ): Promise<RuntimeActionResult> {
    try {
      const { stdout, stderr } = await execFilePromise('docker', args, options);
      return {
        success: true,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };
    } catch (error) {
      const execError = error as { stdout?: string | Buffer; stderr?: string | Buffer; message?: string };
      return {
        success: false,
        stdout: typeof execError.stdout === 'string' ? execError.stdout.trim() : execError.stdout?.toString().trim(),
        stderr: typeof execError.stderr === 'string' ? execError.stderr.trim() : execError.stderr?.toString().trim(),
        error: execError.message ?? 'Unknown error',
      };
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
export class DockerServerConsoleAdapter implements IServerConsolePort {
  /**
   * Get online players via RCON
   */
  async listPlayers(name: ServerName | string): Promise<PlayerListResult | null> {
    const container = workloadNameOf(name);
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

  /** Copied from mcctl-api execRcon / cli execRconWithOutput */
  command(name: ServerName | string, args: string[], options?: { signal?: AbortSignal }): Promise<ConsoleCommandResult> {
    const container = workloadNameOf(name);
    return new Promise((resolve) => {
      const child = spawn('docker', ['exec', '--', container, 'rcon-cli', ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
        ...(options?.signal ? { signal: options.signal } : {}),
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code: number | null) => {
        resolve({ exitCode: code ?? 1, stdout, stderr });
      });

      child.on('error', (err: Error) => {
        resolve({ exitCode: 1, stdout: '', stderr: err.message });
      });
    });
  }

  /** Copied from cli `mcctl rcon` (getContainerRconConfig) */
  async getEndpoint(name: ServerName | string): Promise<ConsoleEndpoint | null> {
    const container = workloadNameOf(name);
    try {
      // Get container IP
      const { stdout: ip } = await execFilePromise('docker', [
        'inspect', '--format', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}', '--', container,
      ]);
      if (!ip.trim()) return null;

      // Get RCON env vars
      const { stdout: envOutput } = await execFilePromise('docker', [
        'inspect', '--format', '{{range .Config.Env}}{{println .}}{{end}}', '--', container,
      ]);

      const env: Record<string, string> = {};
      envOutput.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key) env[key] = valueParts.join('=');
      });

      return {
        host: ip.trim(),
        port: parseInt(env['RCON_PORT'] || '25575', 10),
        password: env['RCON_PASSWORD'] || '',
      };
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
  getHostnames(name: ServerName | string): string {
    const container = workloadNameOf(name);
    const result = execCommand('docker', [
      'inspect',
      '--format',
      '{{index .Config.Labels "mc-router.host"}}',
      '--',
      container,
    ]);

    return result || '-';
  }

  /**
   * Image and env of mc-router from one `docker inspect` (#768)
   */
  inspectRouter(): RouterContainerConfig | null {
    const config = parseJsonObject(execCommand('docker', ['inspect', '--format', '{{json .Config}}', '--', 'mc-router']));
    if (!config) return null;

    const env: Record<string, string> = {};
    if (Array.isArray(config['Env'])) {
      for (const entry of config['Env']) {
        if (typeof entry !== 'string') continue;
        const eq = entry.indexOf('=');
        if (eq > 0) env[entry.slice(0, eq)] = entry.slice(eq + 1);
      }
    }
    const image = typeof config['Image'] === 'string' ? config['Image'] : undefined;
    return { image, env };
  }

  /**
   * All string labels of a container from one `docker inspect` (#768)
   */
  getLabels(name: ServerName | string): Record<string, string> {
    const container = workloadNameOf(name);
    const labels = parseJsonObject(
      execCommand('docker', ['inspect', '--format', '{{json .Config.Labels}}', '--', container])
    );
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(labels ?? {})) {
      if (typeof value === 'string') result[key] = value;
    }
    return result;
  }
}

/** A JSON object from `docker inspect --format '{{json ...}}'`, or null. */
function parseJsonObject(text: string): Record<string, unknown> | null {
  if (!text) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
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
