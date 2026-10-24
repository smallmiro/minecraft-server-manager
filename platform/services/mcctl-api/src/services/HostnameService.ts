import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { HostnameInfo, HostnameData } from '../schemas/hostname.js';
import { validateHostname } from '@minecraft-docker/shared';
import { updateServer } from '../lib/server-spec.js';

/**
 * Regex for matching mc-router.host label in docker-compose.yml
 * Matches: mc-router.host: "hostname1,hostname2" (single or double quotes)
 */
const HOST_LABEL_REGEX = /(mc-router\.host:\s*["'])([^"']+)(["'])/;

/**
 * System hostname patterns
 * - .local: mDNS hostname
 * - .<IP>.nip.io: nip.io wildcard DNS
 */
const SYSTEM_LOCAL_PATTERN = /^[a-z0-9-]+\.local$/;
const SYSTEM_NIPIO_PATTERN = /^[a-z0-9-]+\.\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\.nip\.io$/;

/**
 * HostnameService - Manages server hostname/domain configuration
 * Reads and writes mc-router.host labels in server docker-compose.yml files
 */
export class HostnameService {
  private readonly mcctlRoot: string;

  constructor(mcctlRoot: string) {
    this.mcctlRoot = mcctlRoot;
  }

  /**
   * Get the path to a server's docker-compose.yml file
   */
  private getComposePath(serverName: string): string {
    return join(this.mcctlRoot, 'servers', serverName, 'docker-compose.yml');
  }

  /**
   * Check if a server's docker-compose.yml exists
   */
  composeExists(serverName: string): boolean {
    return existsSync(this.getComposePath(serverName));
  }

  /**
   * Classify a hostname as system or custom
   */
  private classifyHostname(hostname: string, serverName: string): HostnameInfo {
    const trimmed = hostname.trim().toLowerCase();

    // Check for .local pattern (mDNS)
    if (SYSTEM_LOCAL_PATTERN.test(trimmed) && trimmed === `${serverName}.local`) {
      return {
        hostname: trimmed,
        type: 'system',
        description: 'mDNS (Local Network)',
      };
    }

    // Check for .nip.io pattern
    if (SYSTEM_NIPIO_PATTERN.test(trimmed) && trimmed.startsWith(`${serverName}.`)) {
      const ipMatch = trimmed.match(/^[a-z0-9-]+\.(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\.nip\.io$/);
      const ip = ipMatch ? ipMatch[1] : '';
      return {
        hostname: trimmed,
        type: 'system',
        description: `nip.io (${ip})`,
      };
    }

    return {
      hostname: trimmed,
      type: 'custom',
    };
  }

  /**
   * Parse hostnames from docker-compose.yml mc-router.host label
   */
  private parseHostnames(content: string): string[] {
    const match = content.match(HOST_LABEL_REGEX);
    if (!match) {
      return [];
    }
    const hostValue = match[2];
    if (!hostValue) return [];
    return hostValue.split(',').map((h) => h.trim()).filter((h) => h);
  }

  /**
   * Get hostname data for a server
   */
  getHostnames(serverName: string): HostnameData {
    const composePath = this.getComposePath(serverName);

    if (!existsSync(composePath)) {
      throw new Error(`Server compose file not found: ${serverName}`);
    }

    const content = readFileSync(composePath, 'utf-8');
    const rawHostnames = this.parseHostnames(content);

    const classified = rawHostnames.map((h) => this.classifyHostname(h, serverName));
    const systemHostnames = classified.filter((h) => h.type === 'system');
    const customHostnames = classified.filter((h) => h.type === 'custom').map((h) => h.hostname);

    return {
      serverName,
      hostnames: rawHostnames,
      systemHostnames,
      customHostnames,
    };
  }

  /**
   * Validate a custom hostname
   * Returns error message if invalid, null if valid
   */
  validateCustomHostname(hostname: string, serverName: string): string | null {
    const trimmed = hostname.trim().toLowerCase();

    // RFC 1123: the domain hostname rule the ServerSpec validates with (#675)
    const invalid = validateHostname(trimmed);
    if (invalid) {
      return `Invalid hostname format (RFC 1123): ${hostname}: ${invalid}`;
    }

    // Block system hostname patterns
    if (SYSTEM_LOCAL_PATTERN.test(trimmed)) {
      return `Cannot use .local system hostname pattern: ${hostname}`;
    }
    if (SYSTEM_NIPIO_PATTERN.test(trimmed)) {
      return `Cannot use .nip.io system hostname pattern: ${hostname}`;
    }

    return null;
  }

  /**
   * Update custom hostnames for a server through its ServerSpec (#675):
   * routing.customHostnames and routing.playitDomain change in server.yaml and
   * the mc-router label is rendered from them (system hosts are re-derived).
   * `playitDomain`: the PLAYIT_DOMAIN after this edit (resolvePlayitDomain); a
   * listed playit host is kept as the playit domain, not as a custom host.
   */
  async updateCustomHostnames(
    serverName: string,
    customHostnames: string[],
    playitDomain: string | null
  ): Promise<HostnameData> {
    if (!this.composeExists(serverName)) {
      throw new Error(`Server compose file not found: ${serverName}`);
    }

    const normalized = customHostnames.map((h) => h.trim().toLowerCase());
    const seen = new Set<string>();
    for (const hostname of normalized) {
      if (seen.has(hostname)) {
        throw new Error(`Duplicate hostname: ${hostname}`);
      }
      seen.add(hostname);
      const error = this.validateCustomHostname(hostname, serverName);
      if (error) {
        throw new Error(error);
      }
    }

    const playit = playitDomain?.toLowerCase();
    await updateServer(this.mcctlRoot, serverName, (doc) => {
      const { playitDomain: _previous, ...routing } = doc.routing;
      return {
        ...doc,
        routing: {
          ...routing,
          customHostnames: normalized.filter((h) => h !== playit),
          ...(playitDomain ? { playitDomain } : {}),
        },
      };
    });

    return this.getHostnames(serverName);
  }
}

/**
 * Create a HostnameService instance
 */
export function createHostnameService(mcctlRoot: string): HostnameService {
  return new HostnameService(mcctlRoot);
}
