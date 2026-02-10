import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { HostnameInfo, HostnameData } from '../schemas/hostname.js';

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
  private readonly platformPath: string;

  constructor(platformPath: string) {
    this.platformPath = platformPath;
  }

  /**
   * Get the path to a server's docker-compose.yml file
   */
  private getComposePath(serverName: string): string {
    return join(this.platformPath, 'servers', serverName, 'docker-compose.yml');
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

    // Length check (RFC 1123)
    if (trimmed.length === 0 || trimmed.length > 253) {
      return `Hostname must be between 1 and 253 characters: ${hostname}`;
    }

    // RFC 1123 hostname validation
    const hostnamePattern = /^[a-z0-9]([a-z0-9\-.]*[a-z0-9])?$/;
    if (!hostnamePattern.test(trimmed)) {
      return `Invalid hostname format (RFC 1123): ${hostname}`;
    }

    // Each label must be <= 63 characters
    const labels = trimmed.split('.');
    for (const label of labels) {
      if (label.length > 63) {
        return `Hostname label exceeds 63 characters: ${label}`;
      }
      if (label.startsWith('-') || label.endsWith('-')) {
        return `Hostname label cannot start or end with hyphen: ${label}`;
      }
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
   * Update custom hostnames for a server
   * Preserves system hostnames and replaces all custom hostnames
   */
  updateCustomHostnames(
    serverName: string,
    customHostnames: string[]
  ): HostnameData {
    const composePath = this.getComposePath(serverName);

    if (!existsSync(composePath)) {
      throw new Error(`Server compose file not found: ${serverName}`);
    }

    // Validate all custom hostnames
    const normalized = customHostnames.map((h) => h.trim().toLowerCase());

    // Check for duplicates
    const seen = new Set<string>();
    for (const hostname of normalized) {
      if (seen.has(hostname)) {
        throw new Error(`Duplicate hostname: ${hostname}`);
      }
      seen.add(hostname);
    }

    // Validate each hostname
    for (const hostname of normalized) {
      const error = this.validateCustomHostname(hostname, serverName);
      if (error) {
        throw new Error(error);
      }
    }

    // Read current compose file
    let content = readFileSync(composePath, 'utf-8');
    const currentHostnames = this.parseHostnames(content);

    // Get system hostnames from current config
    const systemHostnames = currentHostnames
      .map((h) => this.classifyHostname(h, serverName))
      .filter((h) => h.type === 'system')
      .map((h) => h.hostname);

    // Build new hostname string: system hostnames + custom hostnames
    const newHostnames = [...systemHostnames, ...normalized].join(',');

    // Replace in compose file
    const match = content.match(HOST_LABEL_REGEX);
    if (match) {
      content = content.replace(HOST_LABEL_REGEX, `$1${newHostnames}$3`);
    } else {
      throw new Error(`mc-router.host label not found in docker-compose.yml for server: ${serverName}`);
    }

    writeFileSync(composePath, content, 'utf-8');

    // Return updated data
    return this.getHostnames(serverName);
  }
}

/**
 * Create a HostnameService instance
 */
export function createHostnameService(platformPath: string): HostnameService {
  return new HostnameService(platformPath);
}
