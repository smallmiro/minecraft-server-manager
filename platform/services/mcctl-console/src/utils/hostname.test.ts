import { describe, it, expect } from 'vitest';
import { parseHostnames, getPrimaryHostname, classifyHostname, sortHostnames } from './hostname';

describe('parseHostnames', () => {
  it('should return empty array for undefined', () => {
    expect(parseHostnames(undefined)).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    expect(parseHostnames('')).toEqual([]);
  });

  it('should return single hostname in array', () => {
    expect(parseHostnames('server.local')).toEqual(['server.local']);
  });

  it('should split comma-separated hostnames', () => {
    expect(parseHostnames('server.local,server.192.168.1.1.nip.io')).toEqual([
      'server.local',
      'server.192.168.1.1.nip.io',
    ]);
  });

  it('should trim whitespace from hostnames', () => {
    expect(parseHostnames('server.local , server.192.168.1.1.nip.io , server.10.0.0.1.nip.io')).toEqual([
      'server.local',
      'server.192.168.1.1.nip.io',
      'server.10.0.0.1.nip.io',
    ]);
  });

  it('should filter out empty entries from trailing commas', () => {
    expect(parseHostnames('server.local,')).toEqual(['server.local']);
  });
});

describe('getPrimaryHostname', () => {
  it('should return dash for undefined', () => {
    expect(getPrimaryHostname(undefined)).toBe('-');
  });

  it('should return dash for empty string', () => {
    expect(getPrimaryHostname('')).toBe('-');
  });

  it('should return single hostname as-is', () => {
    expect(getPrimaryHostname('server.local')).toBe('server.local');
  });

  it('should prefer LAN nip.io over .local', () => {
    expect(
      getPrimaryHostname('x.local,x.192.168.1.10.nip.io,x.100.64.0.5.nip.io')
    ).toBe('x.192.168.1.10.nip.io');
  });

  it('should use .local only when nothing else exists', () => {
    expect(getPrimaryHostname('x.local')).toBe('x.local');
  });

  it('should fallback to first hostname when no .local', () => {
    expect(
      getPrimaryHostname('server.192.168.1.1.nip.io,server.10.0.0.1.nip.io')
    ).toBe('server.192.168.1.1.nip.io');
  });
});

describe('classifyHostname', () => {
  it.each([
    ['x.192.168.1.10.nip.io', 'lan'],
    ['x.10.1.2.3.nip.io', 'lan'],
    ['x.172.16.0.1.nip.io', 'lan'],
    ['x.172.31.255.1.nip.io', 'lan'],
    ['x.172.32.0.1.nip.io', 'nip'],
    ['x.100.64.0.5.nip.io', 'vpn'],
    ['x.100.127.1.1.nip.io', 'vpn'],
    ['x.100.128.0.1.nip.io', 'nip'],
    ['x.203.0.113.7.nip.io', 'nip'],
    ['abc.craft.playit.gg', 'external'],
    ['x.local', 'mdns'],
  ])('%s -> %s', (host, kind) => {
    expect(classifyHostname(host)).toBe(kind);
  });
});

describe('sortHostnames', () => {
  it('should order LAN, VPN, other nip.io, external, mDNS', () => {
    expect(
      sortHostnames([
        'x.local',
        'a.craft.playit.gg',
        'x.203.0.113.7.nip.io',
        'x.100.64.0.5.nip.io',
        'x.192.168.1.10.nip.io',
      ])
    ).toEqual([
      'x.192.168.1.10.nip.io',
      'x.100.64.0.5.nip.io',
      'x.203.0.113.7.nip.io',
      'a.craft.playit.gg',
      'x.local',
    ]);
  });

  it('should be stable within the same kind', () => {
    expect(sortHostnames(['x.10.0.0.2.nip.io', 'x.10.0.0.1.nip.io'])).toEqual([
      'x.10.0.0.2.nip.io',
      'x.10.0.0.1.nip.io',
    ]);
  });
});
