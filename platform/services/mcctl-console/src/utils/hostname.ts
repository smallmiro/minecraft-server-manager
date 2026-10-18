/**
 * Parse comma-separated hostname string into an array.
 */
export function parseHostnames(hostname: string | undefined): string[] {
  if (!hostname) return [];
  return hostname
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
}

export type HostnameKind = 'lan' | 'vpn' | 'nip' | 'external' | 'mdns';

const KIND_ORDER: HostnameKind[] = ['lan', 'vpn', 'nip', 'external', 'mdns'];

export const HOSTNAME_KIND_LABEL: Record<HostnameKind, string> = {
  lan: 'LAN',
  vpn: 'Tailscale / VPN',
  nip: 'nip.io',
  external: 'External',
  mdns: 'mDNS',
};

/**
 * Classify a hostname: private-IP nip.io (LAN), 100.64.0.0/10 nip.io (VPN),
 * other nip.io, user/external domain, or mDNS (.local).
 */
export function classifyHostname(host: string): HostnameKind {
  if (host.endsWith('.local')) return 'mdns';
  const m = host.match(/\.(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}\.nip\.io$/);
  if (!m) return 'external';
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return 'lan';
  if (a === 100 && b >= 64 && b <= 127) return 'vpn';
  return 'nip';
}

/** Sort hostnames LAN -> VPN -> other nip.io -> external -> mDNS (stable). */
export function sortHostnames(hosts: string[]): string[] {
  return hosts
    .map((h, i) => ({ h, i, k: KIND_ORDER.indexOf(classifyHostname(h)) }))
    .sort((x, y) => x.k - y.k || x.i - y.i)
    .map((x) => x.h);
}

/**
 * Get the primary (representative) hostname: first of the sorted list (LAN preferred).
 */
export function getPrimaryHostname(hostname: string | undefined): string {
  const hosts = sortHostnames(parseHostnames(hostname));
  return hosts[0] ?? '-';
}
