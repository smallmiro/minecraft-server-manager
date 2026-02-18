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

/**
 * Get the primary (representative) hostname, preferring .local domains.
 */
export function getPrimaryHostname(hostname: string | undefined): string {
  const hosts = parseHostnames(hostname);
  if (hosts.length === 0) return '-';
  return hosts.find((h) => h.endsWith('.local')) || hosts[0];
}
