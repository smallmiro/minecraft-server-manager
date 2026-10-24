import { describe, it, expect } from 'vitest';
import type { ContainerStatus } from '@/ports/api/IMcctlApiClient';
import { classifyHostname, routeStatusDisplay, extractServerName } from './hostnameType';

describe('classifyHostname', () => {
  it('classifies *.local as mDNS', () => {
    expect(classifyHostname('survival.local', [])).toBe('mdns');
  });

  it('classifies *.nip.io as nip.io', () => {
    expect(classifyHostname('survival.192.168.1.5.nip.io', [])).toBe('nipio');
  });

  it('classifies a hostname matching a playit domain as WAN', () => {
    expect(classifyHostname('aa-bb.craft.playit.gg', ['aa-bb.craft.playit.gg'])).toBe('wan');
  });

  it('matches playit domains case-insensitively', () => {
    expect(classifyHostname('AA-BB.craft.playit.gg', ['aa-bb.craft.playit.gg'])).toBe('wan');
    expect(classifyHostname('aa-bb.craft.playit.gg', ['AA-BB.Craft.Playit.GG'])).toBe('wan');
  });

  it('ignores null playit domains', () => {
    expect(classifyHostname('mc.example.com', [null, undefined])).toBe('custom');
  });

  it('classifies everything else as Custom', () => {
    expect(classifyHostname('mc.example.com', ['other.playit.gg'])).toBe('custom');
  });

  it('prefers the playit match over the suffix rules', () => {
    expect(classifyHostname('x.local', ['x.local'])).toBe('wan');
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
