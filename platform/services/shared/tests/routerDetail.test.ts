/**
 * Router detail rules (#768): mc-router auto-scale settings, per-server
 * overrides, resolver host IPs and management API discovery, as pure functions.
 */
import { describe, it, expect } from 'vitest';
import {
  parseGoBool,
  parseRouterAutoScaleEnv,
  resolveRouteAutoScale,
  parseResolverEnv,
  markDiscoveredRoutes,
} from '../src/domain/services/routerDetail.js';

describe('parseGoBool (strconv.ParseBool)', () => {
  it.each(['1', 't', 'T', 'TRUE', 'true', 'True'])('%s is true', (v) => {
    expect(parseGoBool(v)).toBe(true);
  });

  it.each(['0', 'f', 'F', 'FALSE', 'false', 'False'])('%s is false', (v) => {
    expect(parseGoBool(v)).toBe(false);
  });

  it.each([undefined, '', 'yes', 'no', 'tRUE', 'on', '2', ' true'])('%s is undefined', (v) => {
    expect(parseGoBool(v)).toBeUndefined();
  });
});

describe('parseRouterAutoScaleEnv', () => {
  it('reads AUTO_SCALE_UP/DOWN, DOWN_AFTER and ASLEEP_MOTD', () => {
    expect(
      parseRouterAutoScaleEnv({
        AUTO_SCALE_UP: 'true',
        AUTO_SCALE_DOWN: '1',
        AUTO_SCALE_DOWN_AFTER: '10m',
        AUTO_SCALE_ASLEEP_MOTD: '§eSleeping\\n§7Join to wake',
      })
    ).toEqual({ up: true, down: true, downAfter: '10m', asleepMotd: '§eSleeping\\n§7Join to wake' });
  });

  it('missing or invalid booleans are false; empty strings are omitted', () => {
    const result = parseRouterAutoScaleEnv({ AUTO_SCALE_UP: 'yes', AUTO_SCALE_DOWN_AFTER: '' });
    expect(result).toEqual({ up: false, down: false });
    expect('downAfter' in result).toBe(false);
    expect('asleepMotd' in result).toBe(false);
  });
});

describe('resolveRouteAutoScale', () => {
  const global = { up: true, down: false };

  it('a valid label overrides the router global', () => {
    expect(
      resolveRouteAutoScale({ 'mc-router.auto-scale-up': 'false', 'mc-router.auto-scale-down': ' TRUE ' }, global)
    ).toEqual({ up: false, down: true });
  });

  it('a stopped server cannot wake when the global is off, whatever its label says', () => {
    // mc-router 1.47.1 drops stopped containers entirely unless the global AUTO_SCALE_UP is on (docker.go).
    expect(resolveRouteAutoScale({ 'mc-router.auto-scale-up': 'true' }, { up: false, down: false })).toEqual({
      up: false,
      down: false,
    });
  });

  it('an absent or invalid label falls back to the global', () => {
    expect(resolveRouteAutoScale({ 'mc-router.auto-scale-up': 'maybe' }, global)).toEqual({ up: true, down: false });
  });

  it('is undefined when neither a valid label nor the global is known', () => {
    expect(resolveRouteAutoScale({ 'mc-router.auto-scale-down': 'nope' }, undefined)).toEqual({
      up: undefined,
      down: undefined,
    });
    expect(resolveRouteAutoScale({ 'mc-router.auto-scale-up': 't' }, undefined)).toEqual({
      up: true,
      down: undefined,
    });
  });
});

describe('parseResolverEnv', () => {
  it('splits, trims, drops empty and de-duplicates HOST_IPS', () => {
    expect(parseResolverEnv({ HOST_IP: '192.168.1.10', HOST_IPS: ' 192.168.1.10, ,100.64.0.5,192.168.1.10 ' })).toEqual({
      hostIp: '192.168.1.10',
      hostIps: ['192.168.1.10', '100.64.0.5'],
    });
  });

  it('falls back to [HOST_IP] when HOST_IPS is absent or empty', () => {
    expect(parseResolverEnv({ HOST_IP: ' 10.0.0.2 ' })).toEqual({ hostIp: '10.0.0.2', hostIps: ['10.0.0.2'] });
    expect(parseResolverEnv({ HOST_IP: '10.0.0.2', HOST_IPS: ' , ' })).toEqual({
      hostIp: '10.0.0.2',
      hostIps: ['10.0.0.2'],
    });
  });

  it('has no hostIp and an empty list when neither is set', () => {
    const result = parseResolverEnv({ HOST_IP: '  ' });
    expect(result).toEqual({ hostIps: [] });
    expect('hostIp' in result).toBe(false);
  });

  it('keeps HOST_IPS when HOST_IP is absent', () => {
    expect(parseResolverEnv({ HOST_IPS: 'a,b' })).toEqual({ hostIps: ['a', 'b'] });
  });
});

describe('markDiscoveredRoutes', () => {
  const routes = [
    { hostname: 'Alpha.local', target: 'mc-alpha:25565' },
    { hostname: 'beta.local', target: 'mc-beta:25565' },
  ];

  it('marks routes the router lists, comparing hostnames case-insensitively', () => {
    expect(markDiscoveredRoutes(routes, ['alpha.LOCAL', 'other.local'])).toEqual([
      { hostname: 'Alpha.local', target: 'mc-alpha:25565', discoveredByRouter: true },
      { hostname: 'beta.local', target: 'mc-beta:25565', discoveredByRouter: false },
    ]);
  });

  it('leaves discoveredByRouter undefined when the router list is unknown', () => {
    const marked = markDiscoveredRoutes(routes, null);
    expect(marked).toEqual(routes);
    expect(marked.every((r) => !('discoveredByRouter' in r))).toBe(true);
  });

  it('leaves stopped routes unjudged when mc-router does not list stopped containers', () => {
    const mixed = [
      { hostname: 'up.local', serverStatus: 'running' },
      { hostname: 'down.local', serverStatus: 'exited' },
    ];
    const marked = markDiscoveredRoutes(mixed, [], { stoppedRoutesListed: false });
    expect(marked[0]).toEqual({ hostname: 'up.local', serverStatus: 'running', discoveredByRouter: false });
    expect('discoveredByRouter' in marked[1]!).toBe(false);
  });

  it('does not mutate its input', () => {
    markDiscoveredRoutes(routes, []);
    expect(routes.every((r) => !('discoveredByRouter' in r))).toBe(true);
  });
});
