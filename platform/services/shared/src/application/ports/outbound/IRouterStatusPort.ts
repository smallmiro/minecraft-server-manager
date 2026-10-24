import type { HealthStatus } from '../../../types/index.js';
import type { ServerName } from '../../../domain/value-objects/ServerName.js';

/** Configuration of the router workload itself (#768). */
export interface RouterContainerConfig {
  /** Image reference, e.g. `itzg/mc-router:1.47.1`; undefined when not reported. */
  image?: string;
  /** Environment variables of the router workload. */
  env: Record<string, string>;
}

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
  /** Image and env of the router workload; null when it is missing or unreadable (#768). */
  inspectRouter(): RouterContainerConfig | null;
  /**
   * All labels of a server workload (`mc-router.host`, `mc-router.auto-scale-up`, ...);
   * {} when none or unreadable (#768). Same `name` rule as getHostnames.
   */
  getLabels(name: ServerName | string): Record<string, string>;
}
