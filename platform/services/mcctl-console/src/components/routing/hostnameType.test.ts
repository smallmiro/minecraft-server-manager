import { describe, it, expect } from 'vitest';
import type { ContainerStatus } from '@/ports/api/IMcctlApiClient';
import { classifyRouteHostname, routeStatusDisplay, extractServerName, isRouteStartable } from './hostnameType';

describe('classifyRouteHostname', () => {
  it('classifies *.local as mDNS', () => {
    expect(classifyRouteHostname('survival.local', [])).toBe('mdns');
  });

  it('classifies *.nip.io as nip.io', () => {
    expect(classifyRouteHostname('survival.192.168.1.5.nip.io', [])).toBe('nipio');
  });

  it('classifies a hostname matching a playit domain as WAN', () => {
    expect(classifyRouteHostname('aa-bb.craft.playit.gg', ['aa-bb.craft.playit.gg'])).toBe('wan');
  });

  it('matches playit domains case-insensitively', () => {
    expect(classifyRouteHostname('AA-BB.craft.playit.gg', ['aa-bb.craft.playit.gg'])).toBe('wan');
    expect(classifyRouteHostname('aa-bb.craft.playit.gg', ['AA-BB.Craft.Playit.GG'])).toBe('wan');
  });

  it('ignores null playit domains', () => {
    expect(classifyRouteHostname('mc.example.com', [null, undefined])).toBe('custom');
  });

  it('classifies everything else as Custom', () => {
    expect(classifyRouteHostname('mc.example.com', ['other.playit.gg'])).toBe('custom');
  });

  it('prefers the playit match over the suffix rules', () => {
    expect(classifyRouteHostname('x.local', ['x.local'])).toBe('wan');
  });
});

describe('extractServerName', () => {
  it('strips the mc- prefix and :25565 suffix', () => {
    expect(extractServerName('mc-survival:25565')).toBe('survival');
  });

  it('leaves other targets untouched', () => {
    expect(extractServerName('survival')).toBe('survival');
  });
});

describe('routeStatusDisplay', () => {
  const cases: Array<[ContainerStatus, string, string]> = [
    ['running', 'success', 'Running'],
    ['exited', 'warning', 'Stopped · wakes on connect'],
    ['created', 'warning', 'Stopped · wakes on connect'],
    ['restarting', 'warning', 'Restarting'],
    ['paused', 'warning', 'Paused'],
    ['dead', 'error', 'Dead'],
    ['not_found', 'error', 'Not found'],
    ['not_created', 'error', 'Not created'],
  ];

  it.each(cases)('maps %s to %s', (status, color, label) => {
    expect(routeStatusDisplay(status)).toEqual({ color, label });
  });

  it('falls back to default for unknown statuses', () => {
    expect(routeStatusDisplay('stopped' as ContainerStatus)).toEqual({ color: 'default', label: 'stopped' });
  });
});

describe('routeStatusDisplay with auto-scale (#768)', () => {
  it.each<ContainerStatus>(['exited', 'created'])('shows %s + autoScaleUp as Sleeping (warning)', (status) => {
    expect(routeStatusDisplay(status, true)).toEqual({ color: 'warning', label: 'Sleeping · wakes on connect' });
  });

  it.each<ContainerStatus>(['exited', 'created'])('shows %s + no autoScaleUp as Stopped (default)', (status) => {
    expect(routeStatusDisplay(status, false)).toEqual({ color: 'default', label: 'Stopped' });
  });

  it('keeps the #767 mapping when autoScaleUp is unknown', () => {
    expect(routeStatusDisplay('exited', undefined)).toEqual({ color: 'warning', label: 'Stopped · wakes on connect' });
  });

  it('does not change non-stopped statuses', () => {
    expect(routeStatusDisplay('running', true)).toEqual({ color: 'success', label: 'Running' });
    expect(routeStatusDisplay('dead', false)).toEqual({ color: 'error', label: 'Dead' });
  });
});

describe('isRouteStartable', () => {
  it('is true only for exited/created containers', () => {
    expect(isRouteStartable('exited')).toBe(true);
    expect(isRouteStartable('created')).toBe(true);
    expect(isRouteStartable('running')).toBe(false);
    expect(isRouteStartable('dead')).toBe(false);
    expect(isRouteStartable('not_found')).toBe(false);
  });
});
