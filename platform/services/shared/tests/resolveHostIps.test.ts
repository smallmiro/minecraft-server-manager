/**
 * resolveHostIps (#675, ADR-0003 §3): the host addresses used for nip.io
 * router hosts and the avahi entry, in create-server.sh's order, replacing
 * its get_host_ip / get_host_ips (bats create-server-avahi.bats).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { NetworkInterfaceInfo } from 'node:os';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Paths } from '../src/utils/index.js';
import { resolveHostIps, type HostIpProbes } from '../src/infrastructure/hostIps.js';

let root: string;
let paths: Paths;

const iface = (address: string, internal = false): NetworkInterfaceInfo =>
  ({ address, family: 'IPv4', internal, netmask: '255.255.255.0', mac: '', cidr: null }) as NetworkInterfaceInfo;

function probes(opts: {
  route?: string;
  hostnameI?: string;
  interfaces?: Record<string, NetworkInterfaceInfo[]>;
}): HostIpProbes & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    run: (cmd, args) => {
      calls.push([cmd, ...args].join(' '));
      if (cmd === 'ip') return opts.route;
      if (cmd === 'hostname') return opts.hostnameI;
      return undefined;
    },
    interfaces: () => opts.interfaces ?? {},
  };
}

const env = (text: string) => writeFileSync(join(root, '.env'), text);

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-hostips-'));
  paths = new Paths(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('resolveHostIps: .env', () => {
  it('takes HOST_IPS (comma list, trimmed) before HOST_IP, without probing', () => {
    env('HOST_IPS=100.64.0.5, 192.168.1.10 \nHOST_IP=10.0.0.1\n');
    const p = probes({ route: '1.0.0.0 via 1.1.1.1 dev eth0 src 10.9.9.9' });
    expect(resolveHostIps(paths, p)).toEqual(['100.64.0.5', '192.168.1.10']);
    expect(p.calls).toEqual([]);
  });

  it.each([
    ['HOST_IP=192.168.1.10,100.64.0.5 \n', ['192.168.1.10', '100.64.0.5']],
    ['HOST_IP="192.168.1.10 , 100.64.0.5"\n', ['192.168.1.10', '100.64.0.5']],
    ['HOST_IP=192.168.1.10\n', ['192.168.1.10']],
  ])('reads HOST_IP %j as a list', (text, expected) => {
    env(text);
    expect(resolveHostIps(paths, probes({}))).toEqual(expected);
  });
});

describe('resolveHostIps: probes', () => {
  it('uses the src address of `ip route get 1`', () => {
    const p = probes({ route: '1.0.0.0 via 192.168.1.1 dev eth0 src 192.168.1.10 uid 1000\n    cache' });
    expect(resolveHostIps(paths, p)).toEqual(['192.168.1.10']);
    expect(p.calls).toEqual(['ip route get 1']);
  });

  it('falls back to the first address of `hostname -I`', () => {
    const p = probes({ route: '', hostnameI: '192.168.1.10 172.17.0.1 fd00::1\n' });
    expect(resolveHostIps(paths, p)).toEqual(['192.168.1.10']);
    expect(p.calls).toEqual(['ip route get 1', 'hostname -I']);
  });

  it('falls back to the first non-internal IPv4 interface (macOS)', () => {
    const p = probes({ interfaces: { lo0: [iface('127.0.0.1', true)], en0: [iface('192.168.1.20')] } });
    expect(resolveHostIps(paths, p)).toEqual(['192.168.1.20']);
  });

  it('skips docker0, br-* and veth* addresses in every probe', () => {
    const interfaces = {
      docker0: [iface('172.17.0.1')],
      'br-1234': [iface('172.18.0.1')],
      veth9: [iface('169.254.1.1')],
      eth0: [iface('192.168.1.10')],
    };
    expect(resolveHostIps(paths, probes({ route: '1.0.0.0 dev docker0 src 172.17.0.1', interfaces }))).toEqual([
      '192.168.1.10',
    ]);
    expect(resolveHostIps(paths, probes({ hostnameI: '172.17.0.1 172.18.0.1 192.168.1.10', interfaces }))).toEqual([
      '192.168.1.10',
    ]);
  });

  it('returns [] when nothing is found', () => {
    expect(resolveHostIps(paths, probes({}))).toEqual([]);
  });
});

describe('resolveHostIps: probe cache (the API calls it on every spec load and write)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reuses a probe result for a minute instead of running ip/hostname again', () => {
    vi.useFakeTimers();
    const p = probes({ route: '1.0.0.0 via 192.168.1.1 dev eth0 src 192.168.1.10' });
    expect(resolveHostIps(paths, p)).toEqual(['192.168.1.10']);
    expect(resolveHostIps(paths, p)).toEqual(['192.168.1.10']);
    expect(p.calls).toEqual(['ip route get 1']);

    vi.advanceTimersByTime(61_000);
    resolveHostIps(paths, p);
    expect(p.calls).toEqual(['ip route get 1', 'ip route get 1']);
  });

  it('still reads .env first on every call', () => {
    const p = probes({ route: '1.0.0.0 via 192.168.1.1 dev eth0 src 192.168.1.10' });
    expect(resolveHostIps(paths, p)).toEqual(['192.168.1.10']);
    env('HOST_IP=10.0.0.1\n');
    expect(resolveHostIps(paths, p)).toEqual(['10.0.0.1']);
  });
});
