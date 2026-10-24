export type HostnameRegistrarStatus = 'running' | 'installed (not running)' | 'not installed';

/** #675 (ADR-0003). 'skipped' = no/invalid IPv4 or hostname, registrar missing, or sudo failed (see reason). */
export interface HostnameChangeResult {
  status: 'changed' | 'unchanged' | 'skipped';
  reason?: string;
}

/**
 * Hostname Registrar Port - Outbound Port (ADR-0001)
 *
 * Host OS service that announces server hostnames (avahi-daemon on Linux).
 */
export interface IHostnameRegistrarPort {
  getStatus(): HostnameRegistrarStatus;
  /**
   * #675: announce `hostname` at `ip` (`<ip> <hostname>`), unless an entry
   * lists exactly that hostname (#660). Best effort: never rejects.
   */
  register(hostname: string, ip: string): Promise<HostnameChangeResult>;
  /**
   * #735: stop announcing `hostname`: remove the entries that list exactly
   * that hostname (#660). 'unchanged' when none does. Best effort: never rejects.
   */
  unregister(hostname: string): Promise<HostnameChangeResult>;
}
