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
import {
  RuntimeQueryTimeoutError,
  type IContainerRuntimePort,
  type RuntimeActionResult,
  type WorkloadState,
} from '../../application/ports/outbound/IContainerRuntimePort.js';
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
/** `docker stats --no-stream` samples twice (~2 s); past this the child is killed. */
const STATS_TIMEOUT_MS = 5000;
/** Request-path queries (#672): a docker CLI that has not answered by then is killed. */
export const RUNTIME_QUERY_TIMEOUT_MS = 10_000;

/**
 * Awaited `docker <args>` for request paths (#672): trimmed stdout. A non-zero
 * exit is '' (the D1 sentinel) unless `strict`, where it rejects. Past the
 * timeout the child is killed and the query rejects with RuntimeQueryTimeoutError.
 */
async function query(args: string[], options: { strict?: boolean } = {}): Promise<string> {
  try {
    const { stdout } = await execFilePromise('docker', args, {
      encoding: 'utf-8',
      timeout: RUNTIME_QUERY_TIMEOUT_MS,
      killSignal: 'SIGKILL',
      maxBuffer: 10 * 1024 * 1024,
    });
    return String(stdout).trim();
  } catch (error) {
    const failure = error as { killed?: boolean; stderr?: unknown; message?: string };
    if (failure.killed) {
      throw new RuntimeQueryTimeoutError(`docker ${args[0]} did not answer within ${RUNTIME_QUERY_TIMEOUT_MS} ms`);
    }
    if (options.strict) {
      throw new Error(`docker ${args[0]} failed: ${String(failure.stderr ?? '').trim() || failure.message}`);
    }
    return '';
  }
}

/** Health from a `docker ps` status column such as "Up 2 hours (healthy)". */
function healthOfStatusLine(status: string): HealthStatus {
  const match = /\((healthy|unhealthy|health: starting)\)/.exec(status);
  if (!match) return 'none';
  return match[1] === 'health: starting' ? 'starting' : (match[1] as HealthStatus);
}

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
 * Parse `docker stats --no-stream --format '{{.MemUsage}},{{.CPUPerc}}'` output
 * (e.g. "2.1GiB / 4GiB,15.23%"). null when empty or unparseable.
 */
function parseDockerStats(result: string): ContainerStats | null {
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

/** Time since `{{.State.StartedAt}}` as "1d 2h 30m"; null when empty or never started. */
function parseUptime(result: string): { uptime: string; seconds: number } | null {
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

/** `docker ps --format {{.Names}}` output → server workloads (mc-router dropped), sorted. */
function serverWorkloads(result: string): string[] {
  if (!result) return [];

  return result
    .split('\n')
    .filter(name => name && name !== 'mc-router')
    .sort();
}

/** `docker ps` argv for list(): all server containers, or running ones only. */
function listArgs(options?: { running?: boolean }): string[] {
  return options?.running
    ? ['ps', '--filter', 'name=mc-', '--filter', 'status=running', '--format', '{{.Names}}']
    : ['ps', '-a', '--filter', 'name=mc-', '--format', '{{.Names}}'];
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
    const result = await query(['inspect', '-f', '{{.State.Status}}', '--', workloadNameOf(name)]);
    if (!result) return 'not_found';
    return result.toLowerCase() as ContainerStatus;
  }

  async listStates(options?: { strict?: boolean }): Promise<Map<string, WorkloadState>> {
    const result = await query(
      ['ps', '-a', '--filter', 'name=mc-', '--format', '{{.Names}}\t{{.State}}\t{{.Status}}\t{{.Label "mc-router.host"}}'],
      { strict: options?.strict }
    );
    const states = new Map<string, WorkloadState>();
    for (const line of result.split('\n')) {
      const [name, state, status = '', hostname = ''] = line.split('\t');
      if (!name || !state) continue;
      states.set(name, {
        status: state.toLowerCase() as ContainerStatus,
        health: healthOfStatusLine(status),
        hostname: hostname || '-',
      });
    }
    return states;
  }

  async listAsync(options?: { running?: boolean; strict?: boolean }): Promise<string[]> {
    return serverWorkloads(await query(listArgs(options), { strict: options?.strict }));
  }

  async getLogsAsync(name: ServerName | string, lines: number = 50): Promise<string> {
    return query(['logs', '--tail', String(lines), '--', workloadNameOf(name)]);
  }

  async getUptimeAsync(name: ServerName | string): Promise<{ uptime: string; seconds: number } | null> {
    return parseUptime(await query(['inspect', '--format', '{{.State.StartedAt}}', '--', workloadNameOf(name)]));
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
    const args = listArgs(options);
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

    return serverWorkloads(result);
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

    return parseDockerStats(result);
  }

  /** getStats through an awaited `docker stats` (#764). Non-zero exit or unparseable → null. */
  async getStatsAsync(name: ServerName | string): Promise<ContainerStats | null> {
    try {
      // The timeout kills a hung `docker stats`; callers that stop waiting earlier do not leave it running
      const { stdout } = await execFilePromise(
        'docker',
        ['stats', '--no-stream', '--format', '{{.MemUsage}},{{.CPUPerc}}', '--', workloadNameOf(name)],
        { encoding: 'utf-8', timeout: STATS_TIMEOUT_MS, env: this.env() }
      );
      return parseDockerStats(String(stdout).trim());
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

    return parseUptime(result);
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
   * `compose up --force-recreate` (#671): labels are fixed at container
   * creation, so router host changes need a new container. A stopped one is
   * only created (`--no-start`): mc-router auto-scale reads its labels and
   * wakes it, as before.
   */
  async recreate(name: ServerName | string): Promise<RuntimeActionResult> {
    const container = workloadNameOf(name);
    const run = (await this.getStatusAsync(name)) === 'running' ? '-d' : '--no-start';
    return this.compose(['compose', 'up', run, '--force-recreate', '--no-deps', container], this.options.startTimeoutMs);
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

  /**
   * Copied from mcctl-api executeServerAction. The default outlasts the
   * servers' 90s stop_grace_period (#661): a stop that takes the full grace
   * period must not be reported as a failure, nor cut a restart short.
   */
  private compose(args: string[], timeout = 120000): Promise<RuntimeActionResult> {
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
   * Get online players via RCON. Runs `docker exec` as an awaited child process
   * (#764) so callers can probe several servers in parallel; 5 s timeout as before.
   */
  async listPlayers(name: ServerName | string): Promise<PlayerListResult | null> {
    const container = workloadNameOf(name);
    try {
      const { stdout } = await execFilePromise('docker', ['exec', '--', container, 'rcon-cli', 'list'], {
        encoding: 'utf-8',
        timeout: 5000,
      });
      return parseRconPlayerList(stdout);
    } catch {
      return null;
    }
  }

  /**
   * Copied from mcctl-api execRcon / cli execRconWithOutput. rcon-cli parses
   * flags anywhere in its argv, so its own `--` keeps `tp @s -100 64 200` a command (#728).
   */
  command(name: ServerName | string, args: string[], options?: { signal?: AbortSignal }): Promise<ConsoleCommandResult> {
    const container = workloadNameOf(name);
    return new Promise((resolve) => {
      const child = spawn('docker', ['exec', '--', container, 'rcon-cli', '--', ...args], {
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
    return parseRouterConfig(execCommand('docker', ROUTER_CONFIG_ARGS));
  }

  async inspectRouterAsync(): Promise<RouterContainerConfig | null> {
    return parseRouterConfig(await query(ROUTER_CONFIG_ARGS));
  }

  async getLabelsAsync(name: ServerName | string): Promise<Record<string, string>> {
    return parseLabels(await query(labelArgs(name)));
  }

  /**
   * All string labels of a container from one `docker inspect` (#768)
   */
  getLabels(name: ServerName | string): Record<string, string> {
    return parseLabels(execCommand('docker', labelArgs(name)));
  }
}

const ROUTER_CONFIG_ARGS = ['inspect', '--format', '{{json .Config}}', '--', 'mc-router'];
const labelArgs = (name: ServerName | string) => ['inspect', '--format', '{{json .Config.Labels}}', '--', workloadNameOf(name)];

/** Image and env from `docker inspect --format '{{json .Config}}'`, or null. */
function parseRouterConfig(text: string): RouterContainerConfig | null {
  const config = parseJsonObject(text);
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

/** String labels from `docker inspect --format '{{json .Config.Labels}}'`; {} when none or unreadable. */
function parseLabels(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(parseJsonObject(text) ?? {})) {
    if (typeof value === 'string') result[key] = value;
  }
  return result;
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

/** compose up may pull the agent image; past this a hung compose is killed (#672). */
const PLAYIT_COMPOSE_TIMEOUT_MS = 120_000;

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
      ], { cwd: platformRoot, timeout: PLAYIT_COMPOSE_TIMEOUT_MS });

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
      ], { cwd: platformRoot, timeout: PLAYIT_COMPOSE_TIMEOUT_MS });

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

  /** `docker info` answered. A timeout rejects (RuntimeQueryTimeoutError) rather than reading as "unavailable". */
  async isAvailableAsync(): Promise<boolean> {
    try {
      await query(['info'], { strict: true });
      return true;
    } catch (error) {
      if (error instanceof RuntimeQueryTimeoutError) throw error;
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
