import type { HealthStatus } from '../../../types/index.js';
import type { ServerName } from '../../../domain/value-objects/ServerName.js';

/**
 * Router Status Port - Outbound Port (ADR-0001)
 */
export interface IRouterStatusPort {
  /** 'unknown' if the router is not running; else management API probe result. */
  getHealth(): HealthStatus;
  /**
   * Comma-separated router hostnames of a server workload, '-' when none.
   * `name` is the server (#665); a string is the container name (@deprecated, #736).
   */
  getHostnames(name: ServerName | string): string;
}
