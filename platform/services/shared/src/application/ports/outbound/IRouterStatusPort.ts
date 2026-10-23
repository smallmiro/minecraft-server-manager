import type { HealthStatus } from '../../../types/index.js';

/**
 * Router Status Port - Outbound Port (ADR-0001)
 */
export interface IRouterStatusPort {
  /** 'unknown' if the router is not running; else management API probe result. */
  getHealth(): HealthStatus;
  /** Comma-separated router hostnames of a server workload, '-' when none. */
  getHostnames(name: string): string;
}
