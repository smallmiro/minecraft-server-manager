import type { ProcessInfo } from '../../../domain/value-objects/ProcessInfo.js';

/**
 * Service start options
 */
export interface ServiceStartOptions {
  /** Environment variables to pass to the service */
  env?: Record<string, string>;
  /** Working directory for the service */
  cwd?: string;
  /** Whether to wait for the service to be ready */
  wait?: boolean;
  /** Timeout in milliseconds when waiting */
  waitTimeout?: number;
}

/**
 * Service stop options
 */
export interface ServiceStopOptions {
  /** Force stop (SIGKILL) instead of graceful shutdown */
  force?: boolean;
  /** Timeout in milliseconds before force stop */
  timeout?: number;
}

/**
 * Service restart options
 */
export interface ServiceRestartOptions extends ServiceStartOptions, ServiceStopOptions {
  /** Update environment variables before restart */
  updateEnv?: boolean;
}

/**
 * Service logs options
 */
export interface ServiceLogsOptions {
  /** Number of lines to return */
  lines?: number;
  /** Return error logs instead of output logs */
  err?: boolean;
  /** Filter logs by timestamp (return logs after this date) */
  since?: Date;
}

/**
 * Service Manager Port - Outbound Port
 * Interface for managing service processes (PM2, systemd, etc.)
 *
 * This port abstracts process management operations to allow
 * different implementations (PM2, systemd, Docker, etc.)
 */
export interface IServiceManagerPort {
  /**
   * Start a service by name
   * @param name - The service name as defined in ecosystem config
   * @param options - Optional start configuration
   * @throws Error if service not found or start fails
   */
  start(name: string, options?: ServiceStartOptions): Promise<void>;

  /**
   * Stop a service by name
   * @param name - The service name
   * @param options - Optional stop configuration
   * @throws Error if service not found or stop fails
   */
  stop(name: string, options?: ServiceStopOptions): Promise<void>;

  /**
   * Restart a service by name
   * @param name - The service name
   * @param options - Optional restart configuration
   * @throws Error if service not found or restart fails
   */
  restart(name: string, options?: ServiceRestartOptions): Promise<void>;

  /**
   * Get status of one or all services
   * @param name - Optional service name. If not provided, returns all services
   * @returns Array of process information
   */
  status(name?: string): Promise<ProcessInfo[]>;

  /**
   * Get logs for a service
   * @param name - The service name
   * @param options - Optional log retrieval options
   * @returns Log content as string
   */
  logs(name: string, options?: ServiceLogsOptions): Promise<string>;

  /**
   * Delete a service from the process manager
   * @param name - The service name to delete
   * @throws Error if service not found
   */
  delete(name: string): Promise<void>;

  /**
   * Reload ecosystem configuration
   * @param configPath - Path to ecosystem config file
   */
  reload(configPath: string): Promise<void>;

  /**
   * Check if a service exists
   * @param name - The service name
   * @returns true if service is registered
   */
  exists(name: string): Promise<boolean>;

  /**
   * Flush logs for a service
   * @param name - The service name
   */
  flush(name: string): Promise<void>;

  /**
   * Save current process list (for restart persistence)
   */
  save(): Promise<void>;

  /**
   * Resurrect saved processes
   */
  resurrect(): Promise<void>;
}
