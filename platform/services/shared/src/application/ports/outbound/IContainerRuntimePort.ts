import type { ContainerStatus, HealthStatus, ContainerStats } from '../../../types/index.js';
import type { ServerName } from '../../../domain/value-objects/ServerName.js';

/** Lifecycle result. Never rejects; failure is `success: false`. */
export interface RuntimeActionResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
}

/**
 * A runtime query did not answer in time (#672). The query is killed; callers
 * get this instead of a sentinel, so a hung runtime never reads as "absent".
 */
export class RuntimeQueryTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeQueryTimeoutError';
  }
}

/** One workload as `listStates` reports it (#672). */
export interface WorkloadState {
  status: ContainerStatus;
  /** From the runtime's status line: 'none' without a healthcheck or when not running. */
  health: HealthStatus;
  /** `mc-router.host` label, '-' when none. */
  hostname: string;
}

/**
 * Container Runtime Port - Outbound Port (ADR-0001)
 *
 * Per-workload runtime operations.
 * `name` is the server (#665): the adapter maps a ServerName to its workload
 * (Docker: `mc-<server>`). A string is the runtime workload name itself
 * (`mc-<server>`, `mc-router`, `playit-agent`); that form is @deprecated for
 * servers and is narrowed once every caller passes a ServerName (#667; router
 * and playit-agent need #641 first).
 * D1 contract: "absent" and "runtime unreachable" are NOT distinguished (A7 changes this).
 * Synchronous methods remain for the CLI. Request paths use the async ones
 * (#672): they run as awaited child processes with a timeout and reject with
 * RuntimeQueryTimeoutError when it passes; other failures keep the sentinels.
 */
export interface IContainerRuntimePort {
  /** 'not_found' when absent or when the runtime cannot be queried. */
  getStatus(name: ServerName | string): ContainerStatus;
  /**
   * getStatus without blocking the event loop (#665): same sentinel, the query
   * runs as an awaited child process. For callers on request paths.
   */
  getStatusAsync(name: ServerName | string): Promise<ContainerStatus>;
  /** 'none' without a healthcheck, 'unknown' on failure. */
  getHealth(name: ServerName | string): HealthStatus;
  exists(name: ServerName | string): boolean;
  /** Server workloads (mc-* except mc-router), sorted. [] on failure. */
  /**
   * With `strict: true` (#732) a failed query throws instead of returning [], so
   * "none running" and "cannot tell" differ. Default callers keep the D1 contract.
   */
  list(options?: { running?: boolean; strict?: boolean }): string[];
  /** Last `lines` lines (default 50). '' on failure. */
  getLogs(name: ServerName | string, lines?: number): string;
  getStats(name: ServerName | string): ContainerStats | null;
  /**
   * getStats without blocking the event loop (#764): same parsing and null
   * sentinel, the query runs as an awaited child process. For callers on request paths.
   */
  getStatsAsync(name: ServerName | string): Promise<ContainerStats | null>;
  getUptime(name: ServerName | string): { uptime: string; seconds: number } | null;
  getUptimeAsync(name: ServerName | string): Promise<{ uptime: string; seconds: number } | null>;
  getLogsAsync(name: ServerName | string, lines?: number): Promise<string>;
  listAsync(options?: { running?: boolean; strict?: boolean }): Promise<string[]>;
  /**
   * Every `mc-*` workload (mc-router included) keyed by container name, from
   * one runtime query (#672). Rejects when the runtime cannot be queried.
   */
  listStates(): Promise<Map<string, WorkloadState>>;

  /** Create the workload if missing, then run it. */
  start(name: ServerName | string): Promise<RuntimeActionResult>;
  stop(name: ServerName | string): Promise<RuntimeActionResult>;
  restart(name: ServerName | string): Promise<RuntimeActionResult>;
  /**
   * #735 (server delete): stop the workload and remove it. An absent workload
   * is success; a runtime that cannot be queried is a failure, not "absent".
   * Server data is not the runtime's: the ServerSpec repository deletes it.
   */
  remove(name: ServerName | string): Promise<RuntimeActionResult>;

  /** Timestamped lines since `since`, at most `tail` lines. Rejects on failure. */
  readLogs(name: ServerName | string, options: { since: string; tail: number }): Promise<string[]>;
  /**
   * Streams output. New output only by default; `tail: N` emits the last N lines first, then follows (one stream). `follow: false` prints the last `tail`
   * lines (stdout and stderr) and resolves when docker exits.
   * Resolves when the stream ends or `signal` aborts.
   */
  followLogs(
    name: ServerName | string,
    onChunk: (chunk: string) => void,
    signal: AbortSignal,
    options?: {
      tail?: number;
      follow?: boolean;
      /** Called once when the stream ends. `code` is docker's exit code (null if killed or not spawned). The promise still resolves. */
      onExit?: (code: number | null, error?: Error) => void;
    }
  ): Promise<void>;
}
