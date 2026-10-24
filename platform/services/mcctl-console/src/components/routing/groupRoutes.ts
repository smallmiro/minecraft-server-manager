import type { RouteInfo } from '@/ports/api/IMcctlApiClient';
import { classifyRouteHostname, extractServerName, type HostnameType } from './hostnameType';

/** Display order; the first hostname in this order is the server's primary address. */
export const HOSTNAME_TYPE_ORDER: readonly HostnameType[] = ['nipio', 'mdns', 'wan', 'custom'];

export interface ServerHostname {
  /** hostname alone can repeat within a server. */
  key: string;
  hostname: string;
  type: HostnameType;
  discoveredByRouter?: boolean;
}

export interface ServerRouteGroup {
  serverName: string;
  /** "<type> <version>", empty when no route carries them. */
  detail: string;
  /** Server-level fields (status, auto-scale): every hostname of a server targets the same container. */
  route: RouteInfo;
  /** Sorted by HOSTNAME_TYPE_ORDER; never empty. */
  hostnames: ServerHostname[];
  typeCounts: Array<{ type: HostnameType; count: number }>;
  notRoutedCount: number;
}

const routeDetail = (route: RouteInfo) => [route.serverType, route.serverVersion].filter(Boolean).join(' ');

export function groupRoutesByServer(
  routes: RouteInfo[],
  playitDomains: ReadonlyArray<string | null | undefined>
): ServerRouteGroup[] {
  const byServer = new Map<string, RouteInfo[]>();
  for (const route of routes) {
    const name = extractServerName(route.target);
    const list = byServer.get(name);
    if (list) list.push(route);
    else byServer.set(name, [route]);
  }

  return Array.from(byServer, ([serverName, serverRoutes]) => {
    const hostnames = serverRoutes
      .map((route, index) => ({
        key: `${route.hostname}|${index}`,
        hostname: route.hostname,
        type: classifyRouteHostname(route.hostname, playitDomains),
        discoveredByRouter: route.discoveredByRouter,
      }))
      .sort((a, b) => HOSTNAME_TYPE_ORDER.indexOf(a.type) - HOSTNAME_TYPE_ORDER.indexOf(b.type));

    return {
      serverName,
      detail: serverRoutes.map(routeDetail).find(Boolean) ?? '',
      route: serverRoutes[0],
      hostnames,
      typeCounts: HOSTNAME_TYPE_ORDER.map((type) => ({
        type,
        count: hostnames.filter((h) => h.type === type).length,
      })).filter((entry) => entry.count > 0),
      notRoutedCount: hostnames.filter((h) => h.discoveredByRouter === false).length,
    };
  });
}
