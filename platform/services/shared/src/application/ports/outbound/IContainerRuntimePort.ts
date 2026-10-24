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
 * Container Runtime Port - Outbound Port (ADR-0001)
 *
 * Per-workload runtime operations.
 * `name` is the server (#665): the adapter maps a ServerName to its workload
 * (Docker: `mc-<server>`). A string is the runtime workload name itself
 * (`mc-<server>`, `mc-router`, `playit-agent`); that form is @deprecated for
 * servers and narrowed in v3.0.0 (#736).
 * D1 contract: "absent" and "runtime unreachable" are NOT distinguished (A7 changes this).
 * Synchronous methods stay synchronous until C2.
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

  /** Create the workload if missing, then run it. */
  start(name: ServerName | string): Promise<RuntimeActionResult>;
  stop(name: ServerName | string): Promise<RuntimeActionResult>;
  restart(name: ServerName | string): Promise<RuntimeActionResult>;

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
