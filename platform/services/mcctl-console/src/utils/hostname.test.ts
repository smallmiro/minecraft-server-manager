import { describe, it, expect } from 'vitest';
import { parseHostnames, getPrimaryHostname } from './hostname';

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

  it('should prefer .local hostname', () => {
    expect(
      getPrimaryHostname('server.192.168.1.1.nip.io,server.local,server.10.0.0.1.nip.io')
    ).toBe('server.local');
  });

  it('should fallback to first hostname when no .local', () => {
    expect(
      getPrimaryHostname('server.192.168.1.1.nip.io,server.10.0.0.1.nip.io')
    ).toBe('server.192.168.1.1.nip.io');
  });
});
