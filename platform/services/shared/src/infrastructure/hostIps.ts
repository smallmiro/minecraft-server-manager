import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
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

/** HostIpProbes whose commands are awaited (#672). */
export interface AsyncHostIpProbes {
  run(cmd: string, args: string[]): Promise<string | undefined>;
  interfaces(): NodeJS.Dict<NetworkInterfaceInfo[]>;
}

const execFileAsync = promisify(execFile);
const systemProbesAsync: AsyncHostIpProbes = {
  run: async (cmd, args) => {
    try {
      return (await execFileAsync(cmd, args, { encoding: 'utf-8', timeout: 2000 })).stdout;
    } catch {
      return undefined;
    }
  },
  interfaces: () => networkInterfaces(),
};

/**
 * Probe results per probe set, reused for PROBE_TTL_MS. An address change
 * shows up only after the TTL. `.env` is read on every call. The sync form
 * (CLI) blocks on ip/hostname (up to 2 s each); request paths use
 * resolveHostIpsAsync.
 */
const PROBE_TTL_MS = 60_000;
const probed = new WeakMap<HostIpProbes | AsyncHostIpProbes, { at: number; ips: string[] }>();

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
  const fromEnv = readEnvHostIps(paths);
  if (fromEnv.length > 0) return fromEnv;

  const cached = cachedProbe(probes);
  if (cached) return cached;
  const usable = usableAddresses(probes.interfaces());
  return remember(
    probes,
    fromRoute(probes.run('ip', ['route', 'get', '1']), usable) ??
      fromHostnameI(probes.run('hostname', ['-I']), usable) ??
      fromInterfaces(usable)
  );
}

/** resolveHostIps with awaited probes (#672), for request paths. Same order and cache. */
export async function resolveHostIpsAsync(
  paths: Paths,
  probes: AsyncHostIpProbes = systemProbesAsync
): Promise<string[]> {
  const fromEnv = readEnvHostIps(paths);
  if (fromEnv.length > 0) return fromEnv;

  const cached = cachedProbe(probes);
  if (cached) return cached;
  const usable = usableAddresses(probes.interfaces());
  return remember(
    probes,
    fromRoute(await probes.run('ip', ['route', 'get', '1']), usable) ??
      fromHostnameI(await probes.run('hostname', ['-I']), usable) ??
      fromInterfaces(usable)
  );
}

/** `.env` HOST_IPS, else HOST_IP, as a list ([] when unset or unreadable). */
function readEnvHostIps(paths: Paths): string[] {
  let envText: string;
  try {
    envText = readFileSync(paths.envFile, 'utf-8');
  } catch {
    return [];
  }
  const values = parseEnvDocument(envText).values;
  const list = values.get('HOST_IPS')?.trim() || values.get('HOST_IP')?.trim() || '';
  return list.split(',').map((ip) => ip.trim()).filter(Boolean);
}

function cachedProbe(probes: HostIpProbes | AsyncHostIpProbes): string[] | undefined {
  const cached = probed.get(probes);
  return cached && Date.now() - cached.at < PROBE_TTL_MS ? [...cached.ips] : undefined;
}

function remember(probes: HostIpProbes | AsyncHostIpProbes, ips: string[]): string[] {
  probed.set(probes, { at: Date.now(), ips });
  return [...ips];
}

interface Usable {
  ifaces: Array<[string, NetworkInterfaceInfo[] | undefined]>;
  ok: (ip: string | undefined, dev?: string) => ip is string;
}

function usableAddresses(interfaces: NodeJS.Dict<NetworkInterfaceInfo[]>): Usable {
  const ifaces = Object.entries(interfaces);
  const virtual = new Set(
    ifaces.filter(([name]) => VIRTUAL_IFACE.test(name)).flatMap(([, infos]) => (infos ?? []).map((i) => i.address))
  );
  const ok = (ip: string | undefined, dev?: string): ip is string =>
    !!ip && IPV4.test(ip) && !virtual.has(ip) && !(dev && VIRTUAL_IFACE.test(dev));
  return { ifaces, ok };
}

/** The src address of `ip route get 1`, unless it is on a virtual device. */
function fromRoute(route: string | undefined, usable: Usable): string[] | undefined {
  const src = /\bsrc (\S+)/.exec(route ?? '')?.[1];
  return usable.ok(src, /\bdev (\S+)/.exec(route ?? '')?.[1]) ? [src] : undefined;
}

function fromHostnameI(output: string | undefined, usable: Usable): string[] | undefined {
  const first = (output ?? '').split(/\s+/).find((ip) => usable.ok(ip));
  return first ? [first] : undefined;
}

/** The first non-internal IPv4 interface (macOS), else []. */
function fromInterfaces(usable: Usable): string[] {
  for (const [name, infos] of usable.ifaces) {
    if (VIRTUAL_IFACE.test(name)) continue;
    const info = (infos ?? []).find((i) => i.family === 'IPv4' && !i.internal);
    if (info) return [info.address];
  }
  return [];
}
