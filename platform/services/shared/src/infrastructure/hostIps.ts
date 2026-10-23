import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os';
import type { Paths } from '../utils/index.js';
import { parseEnvDocument } from '../utils/env-file.js';

/** System lookups behind resolveHostIps; replaced in tests. */
export interface HostIpProbes {
  /** stdout of a command, or undefined when it fails or is missing. */
  run(cmd: string, args: string[]): string | undefined;
  interfaces(): NodeJS.Dict<NetworkInterfaceInfo[]>;
}

const systemProbes: HostIpProbes = {
  run: (cmd, args) => {
    try {
      return execFileSync(cmd, args, { encoding: 'utf-8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      return undefined;
    }
  },
  interfaces: () => networkInterfaces(),
};

/** Container bridges and veth pairs: never a host address. */
const VIRTUAL_IFACE = /^(docker0|br-.+|veth.+)$/;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * The host addresses for nip.io router hosts (all) and avahi (the first),
 * in create-server.sh's order (ADR-0003 §3): `.env` HOST_IPS, else HOST_IP
 * (comma lists); else the src address of `ip route get 1`; else the first
 * address of `hostname -I`; else the first non-internal IPv4 interface
 * (macOS). docker0, br-* and veth* addresses are skipped in every probe.
 */
export function resolveHostIps(paths: Paths, probes: HostIpProbes = systemProbes): string[] {
  let envText: string | undefined;
  try {
    envText = readFileSync(paths.envFile, 'utf-8');
  } catch {
    envText = undefined;
  }
  if (envText !== undefined) {
    const values = parseEnvDocument(envText).values;
    const list = values.get('HOST_IPS')?.trim() || values.get('HOST_IP')?.trim() || '';
    const ips = list.split(',').map((ip) => ip.trim()).filter(Boolean);
    if (ips.length > 0) return ips;
  }

  const ifaces = Object.entries(probes.interfaces());
  const virtual = new Set(
    ifaces.filter(([name]) => VIRTUAL_IFACE.test(name)).flatMap(([, infos]) => (infos ?? []).map((i) => i.address))
  );
  const usable = (ip: string | undefined, dev?: string): ip is string =>
    !!ip && IPV4.test(ip) && !virtual.has(ip) && !(dev && VIRTUAL_IFACE.test(dev));

  const route = probes.run('ip', ['route', 'get', '1']) ?? '';
  const src = /\bsrc (\S+)/.exec(route)?.[1];
  if (usable(src, /\bdev (\S+)/.exec(route)?.[1])) return [src];

  const first = (probes.run('hostname', ['-I']) ?? '').split(/\s+/).find((ip) => usable(ip));
  if (first) return [first];

  for (const [name, infos] of ifaces) {
    if (VIRTUAL_IFACE.test(name)) continue;
    const info = (infos ?? []).find((i) => i.family === 'IPv4' && !i.internal);
    if (info) return [info.address];
  }
  return [];
}
