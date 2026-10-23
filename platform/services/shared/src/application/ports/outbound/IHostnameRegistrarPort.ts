export type HostnameRegistrarStatus = 'running' | 'installed (not running)' | 'not installed';

/**
 * Hostname Registrar Port - Outbound Port (ADR-0001)
 *
 * Host OS service that announces server hostnames (avahi-daemon on Linux).
 */
export interface IHostnameRegistrarPort {
  getStatus(): HostnameRegistrarStatus;
}
