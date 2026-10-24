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

/** mc-router target (`mc-<name>:25565`) to server name. */
export function extractServerName(target: string): string {
  return target.replace(/^mc-/, '').replace(/:25565$/, '');
}

/**
 * Stopped servers (exited/created) are the normal auto-scale state, so they are
 * a warning rather than an error; only dead/missing containers are errors.
 */
export function routeStatusDisplay(status: ContainerStatus): RouteStatusDisplay {
  switch (status) {
    case 'running':
      return { color: 'success', label: 'Running' };
    case 'exited':
    case 'created':
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
