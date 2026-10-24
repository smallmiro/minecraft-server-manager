import type { ContainerStatus } from '@/ports/api/IMcctlApiClient';

export type HostnameType = 'mdns' | 'nipio' | 'wan' | 'custom';

export type StatusColor = 'success' | 'warning' | 'error' | 'default';

export interface RouteStatusDisplay {
  color: StatusColor;
  label: string;
}

export const HOSTNAME_TYPE_LABEL: Record<HostnameType, string> = {
  mdns: 'mDNS',
  nipio: 'nip.io',
  wan: 'WAN',
  custom: 'Custom',
};

/**
 * Classify a route hostname. A playit domain wins over the suffix rules because
 * it is the only signal that a hostname is reachable from the WAN.
 */
export function classifyRouteHostname(
  hostname: string,
  playitDomains: ReadonlyArray<string | null | undefined>
): HostnameType {
  const host = hostname.toLowerCase();
  if (playitDomains.some((domain) => domain && domain.toLowerCase() === host)) return 'wan';
  if (host.endsWith('.local')) return 'mdns';
  if (host.endsWith('.nip.io')) return 'nipio';
  return 'custom';
}

// nip.io first: it works from any LAN client without mDNS support.
const PRIMARY_ORDER: readonly HostnameType[] = ['nipio', 'mdns', 'wan', 'custom'];

/**
 * The hostname a server row shows while collapsed. Hostnames mc-router has not
 * registered come last, since copying one gives an address that does not connect.
 * Ties keep the route order.
 */
export function pickPrimaryHostname<T extends { type: HostnameType; discoveredByRouter?: boolean }>(
  hosts: readonly T[]
): T {
  const rank = (host: T) =>
    (host.discoveredByRouter === false ? PRIMARY_ORDER.length : 0) + PRIMARY_ORDER.indexOf(host.type);
  return hosts.reduce((best, host) => (rank(host) < rank(best) ? host : best));
}

/** mc-router target (`mc-<name>:25565`) to server name. */
export function extractServerName(target: string): string {
  return target.replace(/^mc-/, '').replace(/:25565$/, '');
}

/** Containers that `docker start` can bring up (the Wake/Start action is offered for these). */
export function isRouteStartable(status: ContainerStatus): boolean {
  return status === 'exited' || status === 'created';
}

/**
 * Stopped servers (exited/created) are the normal auto-scale state, so they are
 * a warning rather than an error; only dead/missing containers are errors.
 */
export function routeStatusDisplay(status: ContainerStatus, autoScaleUp?: boolean): RouteStatusDisplay {
  switch (status) {
    case 'running':
      return { color: 'success', label: 'Running' };
    case 'exited':
    case 'created':
      // autoScaleUp is only known when container labels could be read; otherwise keep the #767 wording.
      if (autoScaleUp === true) return { color: 'warning', label: 'Sleeping · wakes on connect' };
      if (autoScaleUp === false) return { color: 'default', label: 'Stopped' };
      return { color: 'warning', label: 'Stopped · wakes on connect' };
    case 'restarting':
      return { color: 'warning', label: 'Restarting' };
    case 'paused':
      return { color: 'warning', label: 'Paused' };
    case 'dead':
      return { color: 'error', label: 'Dead' };
    case 'not_found':
      return { color: 'error', label: 'Not found' };
    case 'not_created':
      return { color: 'error', label: 'Not created' };
    default:
      return { color: 'default', label: String(status) };
  }
}
