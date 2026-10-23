/**
 * Docker naming rules for server workloads (ADR-0001, D4 #665).
 *
 * The runtime rules (`mc-<server>` container, `<server>.local` hostname) live
 * here, not in the domain. No runtime imports: the deprecated ServerName getters
 * delegate here and `@minecraft-docker/shared/naming` must stay browser-safe.
 */
import type { ServerName } from '../../domain/value-objects/ServerName.js';

const valueOf = (server: ServerName | string): string => (typeof server === 'string' ? server : server.value);

/** Docker container (compose service) name of a server: `mc-<server>`. */
export function containerNameOf(server: ServerName | string): string {
  return `mc-${valueOf(server)}`;
}

/** mDNS hostname of a server for mc-router: `<server>.local`. */
export function serverHostnameOf(server: ServerName | string): string {
  return `${valueOf(server)}.local`;
}

/**
 * The workload a port argument names. A ServerName maps to its container; a
 * string is taken as the container name itself (the deprecated v2 form).
 */
export function workloadNameOf(name: ServerName | string): string {
  return typeof name === 'string' ? name : containerNameOf(name);
}
