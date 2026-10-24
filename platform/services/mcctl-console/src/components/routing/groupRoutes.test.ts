import { describe, it, expect } from 'vitest';
import { groupRoutesByServer } from './groupRoutes';
import type { RouteInfo } from '@/ports/api/IMcctlApiClient';

const route = (hostname: string, server: string, extra: Partial<RouteInfo> = {}): RouteInfo => ({
  hostname,
  target: `mc-${server}:25565`,
  serverStatus: 'running',
  ...extra,
});

describe('groupRoutesByServer', () => {
  it('returns no groups for no routes', () => {
    expect(groupRoutesByServer([], [])).toEqual([]);
  });

  it('groups hostnames by target server, keeping the order servers first appear in', () => {
    const groups = groupRoutesByServer(
      [route('b.local', 'beta'), route('a.local', 'alpha'), route('b.1.2.3.4.nip.io', 'beta')],
      []
    );
    expect(groups.map((g) => g.serverName)).toEqual(['beta', 'alpha']);
    expect(groups[0].hostnames.map((h) => h.hostname)).toEqual(['b.1.2.3.4.nip.io', 'b.local']);
    expect(groups[1].hostnames.map((h) => h.hostname)).toEqual(['a.local']);
  });

  it('sorts hostnames nip.io, mDNS, WAN, Custom so the first one is the primary address', () => {
    const [group] = groupRoutesByServer(
      [
        route('play.example.com', 's'),
        route('aa-bb.craft.playit.gg', 's'),
        route('s.local', 's'),
        route('s.192.168.0.10.nip.io', 's'),
        route('s.10.0.0.5.nip.io', 's'),
      ],
      ['aa-bb.craft.playit.gg']
    );
    expect(group.hostnames.map((h) => [h.hostname, h.type])).toEqual([
      ['s.192.168.0.10.nip.io', 'nipio'],
      ['s.10.0.0.5.nip.io', 'nipio'],
      ['s.local', 'mdns'],
      ['aa-bb.craft.playit.gg', 'wan'],
      ['play.example.com', 'custom'],
    ]);
  });

  it('puts hostnames mc-router has not registered after the routed ones, so they are never primary while a routed one exists', () => {
    const [group] = groupRoutesByServer(
      [
        route('s.1.1.1.1.nip.io', 's', { discoveredByRouter: false }),
        route('play.example.com', 's'),
        route('s.local', 's', { discoveredByRouter: true }),
      ],
      []
    );
    expect(group.hostnames.map((h) => h.hostname)).toEqual(['s.local', 'play.example.com', 's.1.1.1.1.nip.io']);
  });

  it('counts hostnames per type, in display order, leaving out absent types', () => {
    const [group] = groupRoutesByServer(
      [route('s.local', 's'), route('s.1.1.1.1.nip.io', 's'), route('s.2.2.2.2.nip.io', 's')],
      []
    );
    expect(group.typeCounts).toEqual([
      { type: 'nipio', count: 2 },
      { type: 'mdns', count: 1 },
    ]);
  });

  it('counts only hostnames mc-router reported as missing as not routed', () => {
    const [group] = groupRoutesByServer(
      [
        route('a.local', 's', { discoveredByRouter: false }),
        route('b.local', 's', { discoveredByRouter: true }),
        route('c.local', 's'),
      ],
      []
    );
    expect(group.notRoutedCount).toBe(1);
    expect(group.hostnames.find((h) => h.hostname === 'a.local')?.discoveredByRouter).toBe(false);
  });

  it('takes server status and auto-scale from the server routes', () => {
    const [group] = groupRoutesByServer(
      [route('a.local', 's', { serverStatus: 'exited', autoScaleUp: true, autoScaleDown: true })],
      []
    );
    expect(group.route.serverStatus).toBe('exited');
    expect(group.route.autoScaleUp).toBe(true);
  });

  it('uses the first route that carries type and version for the detail line', () => {
    const [group] = groupRoutesByServer(
      [
        route('aa-bb.craft.playit.gg', 's'),
        route('s.local', 's', { serverType: 'PAPER', serverVersion: '1.21.1' }),
      ],
      []
    );
    expect(group.detail).toBe('PAPER 1.21.1');
  });

  it('gives every hostname a unique key, even when a hostname repeats', () => {
    const [group] = groupRoutesByServer([route('play.example.com', 's'), route('play.example.com', 's')], []);
    const keys = group.hostnames.map((h) => h.key);
    expect(new Set(keys).size).toBe(2);
  });
});
