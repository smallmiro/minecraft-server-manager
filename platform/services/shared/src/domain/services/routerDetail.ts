/**
 * mc-router detail rules (#768).
 *
 * Pure functions that compute what mc-router does from its inputs: the router
 * container env (global auto-scale), a server's container labels (per-server
 * override) and the routes the management API reports. Adapters supply the raw inputs.
 */

/** Global auto-scale settings of the mc-router container. */
export interface RouterAutoScale {
  /** AUTO_SCALE_UP: start a stopped server when a client connects. */
  up: boolean;
  /** AUTO_SCALE_DOWN: stop an idle server. */
  down: boolean;
  /** AUTO_SCALE_DOWN_AFTER as written (Go duration, e.g. `10m`). */
  downAfter?: string;
  /** AUTO_SCALE_ASLEEP_MOTD as written; may contain literal `\n` and § codes. */
  asleepMotd?: string;
}

/** Host addresses used for `<server>.<ip>.nip.io` router hosts. */
export interface RouterResolver {
  /** The primary address (first of hostIps); absent when none is known. */
  hostIp?: string;
  /** resolveHostIps: `.env` HOST_IPS / HOST_IP comma lists, else the probed host address. */
  hostIps: string[];
}

/** Effective per-server auto-scale; undefined when it cannot be determined. */
export interface RouteAutoScale {
  up?: boolean;
  down?: boolean;
}

type EnvValues = Readonly<Record<string, string | undefined>>;

const GO_TRUE = new Set(['1', 't', 'T', 'TRUE', 'true', 'True']);
const GO_FALSE = new Set(['0', 'f', 'F', 'FALSE', 'false', 'False']);

/** Go's strconv.ParseBool: undefined when the value is missing or invalid. */
export function parseGoBool(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (GO_TRUE.has(value)) return true;
  if (GO_FALSE.has(value)) return false;
  return undefined;
}

/** The router's global auto-scale settings; a missing or invalid boolean is false. */
export function parseRouterAutoScaleEnv(env: EnvValues): RouterAutoScale {
  const result: RouterAutoScale = {
    up: parseGoBool(env['AUTO_SCALE_UP']) ?? false,
    down: parseGoBool(env['AUTO_SCALE_DOWN']) ?? false,
  };
  const downAfter = env['AUTO_SCALE_DOWN_AFTER'];
  if (downAfter) result.downAfter = downAfter;
  const asleepMotd = env['AUTO_SCALE_ASLEEP_MOTD'];
  if (asleepMotd) result.asleepMotd = asleepMotd;
  return result;
}

export const AUTO_SCALE_UP_LABEL = 'mc-router.auto-scale-up';
export const AUTO_SCALE_DOWN_LABEL = 'mc-router.auto-scale-down';

/**
 * Effective auto-scale of one server, as mc-router computes it: a label that
 * parses as a bool (trimmed) wins, otherwise the router global. Scale-up also
 * needs the global on: with AUTO_SCALE_UP off mc-router ignores stopped
 * containers entirely, so no label can make them wake (docker.go, v1.47.1).
 */
export function resolveRouteAutoScale(labels: EnvValues, global: RouterAutoScale | undefined): RouteAutoScale {
  const up = global?.up === false ? false : (parseGoBool(labels[AUTO_SCALE_UP_LABEL]?.trim()) ?? global?.up);
  return {
    up,
    down: parseGoBool(labels[AUTO_SCALE_DOWN_LABEL]?.trim()) ?? global?.down,
  };
}

/**
 * Copies of `routes` with `discoveredByRouter` set from the hostnames the
 * management API lists (case-insensitive). `null` means the list is unknown:
 * the field is left out. With `stoppedRoutesListed: false` (global
 * AUTO_SCALE_UP off) mc-router never lists stopped containers, so their
 * absence says nothing and those routes are left out too.
 */
export function markDiscoveredRoutes<T extends { hostname: string; serverStatus?: string }>(
  routes: readonly T[],
  discovered: Iterable<string> | null,
  options: { stoppedRoutesListed?: boolean } = {}
): Array<T & { discoveredByRouter?: boolean }> {
  if (discovered === null) return routes.map((route) => ({ ...route }));
  const known = new Set<string>();
  for (const hostname of discovered) known.add(hostname.toLowerCase());
  const stoppedListed = options.stoppedRoutesListed ?? true;
  return routes.map((route) =>
    !stoppedListed && route.serverStatus !== 'running'
      ? { ...route }
      : { ...route, discoveredByRouter: known.has(route.hostname.toLowerCase()) }
  );
}
