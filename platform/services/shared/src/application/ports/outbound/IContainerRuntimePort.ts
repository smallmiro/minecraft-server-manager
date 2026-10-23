import type { ContainerStatus, HealthStatus, ContainerStats } from '../../../types/index.js';

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
 * `name` is the runtime workload name. In D1 this is the Docker container name (`mc-<server>`).
 * D1 contract: "absent" and "runtime unreachable" are NOT distinguished (A7 changes this).
 * Synchronous methods stay synchronous until C2.
 */
export interface IContainerRuntimePort {
  /** 'not_found' when absent or when the runtime cannot be queried. */
  getStatus(name: string): ContainerStatus;
  /** 'none' without a healthcheck, 'unknown' on failure. */
  getHealth(name: string): HealthStatus;
  exists(name: string): boolean;
  /** Server workloads (mc-* except mc-router), sorted. [] on failure. */
  /**
   * With `strict: true` (#732) a failed query throws instead of returning [], so
   * "none running" and "cannot tell" differ. Default callers keep the D1 contract.
   */
  list(options?: { running?: boolean; strict?: boolean }): string[];
  /** Last `lines` lines (default 50). '' on failure. */
  getLogs(name: string, lines?: number): string;
  getStats(name: string): ContainerStats | null;
  getUptime(name: string): { uptime: string; seconds: number } | null;

  /** Create the workload if missing, then run it. */
  start(name: string): Promise<RuntimeActionResult>;
  stop(name: string): Promise<RuntimeActionResult>;
  restart(name: string): Promise<RuntimeActionResult>;

  /** Timestamped lines since `since`, at most `tail` lines. Rejects on failure. */
  readLogs(name: string, options: { since: string; tail: number }): Promise<string[]>;
  /** Streams new output only. Resolves when the stream ends or `signal` aborts. */
  followLogs(name: string, onChunk: (chunk: string) => void, signal: AbortSignal): Promise<void>;
}
