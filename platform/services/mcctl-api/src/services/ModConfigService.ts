import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ModSourceFactory } from '@minecraft-docker/shared';

/**
 * Parse config.env file content into key-value pairs
 */
function parseEnvFile(content: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex > 0) {
      result.set(line.substring(0, eqIndex).trim(), line.substring(eqIndex + 1).trim());
    }
  }
  return result;
}

/**
 * Update a single key in env file content while preserving comments and structure
 */
function updateEnvFile(content: string, key: string, value: string): string {
  const lines = content.split('\n');
  let found = false;
  const result = lines.map((line) => {
    const eqIndex = line.indexOf('=');
    if (eqIndex > 0) {
      const lineKey = line.substring(0, eqIndex).trim();
      if (lineKey === key) {
        found = true;
        return `${key}=${value}`;
      }
    }
    return line;
  });
  if (!found) {
    result.push(`${key}=${value}`);
  }
  return result.join('\n');
}

/**
 * Parse a comma-separated mod list string into an array
 */
function parseModList(value: string | undefined): string[] {
  if (!value || !value.trim()) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * ModConfigService - Manages mod configuration in server config.env files
 */
export class ModConfigService {
  private readonly platformPath: string;

  constructor(platformPath: string) {
    this.platformPath = platformPath;
  }

  /**
   * Get the path to a server's config.env file
   */
  private getConfigPath(serverName: string): string {
    return join(this.platformPath, 'servers', serverName, 'config.env');
  }

  /**
   * Check if a server's configuration exists
   */
  configExists(serverName: string): boolean {
    return existsSync(this.getConfigPath(serverName));
  }

  /**
   * List installed mods grouped by source
   */
  getInstalledMods(serverName: string): Record<string, string[]> {
    const configPath = this.getConfigPath(serverName);
    if (!existsSync(configPath)) {
      return {};
    }

    const content = readFileSync(configPath, 'utf-8');
    const envMap = parseEnvFile(content);

    const mods: Record<string, string[]> = {};
    for (const adapter of ModSourceFactory.getAllAdapters()) {
      const envKey = adapter.getEnvKey();
      const value = envMap.get(envKey);
      if (value) {
        mods[adapter.sourceName] = parseModList(value);
      }
    }

    return mods;
  }

  /**
   * Add mods to a server's configuration
   * Returns the list of newly added slugs (deduplicates existing ones)
   */
  addMods(serverName: string, slugs: string[], sourceName: string): { added: string[]; mods: string[] } {
    const configPath = this.getConfigPath(serverName);
    const adapter = ModSourceFactory.get(sourceName);
    const envKey = adapter.getEnvKey();

    const content = readFileSync(configPath, 'utf-8');
    const envMap = parseEnvFile(content);
    const existing = parseModList(envMap.get(envKey));

    const added: string[] = [];
    for (const slug of slugs) {
      if (!existing.includes(slug)) {
        existing.push(slug);
        added.push(slug);
      }
    }

    const updatedContent = updateEnvFile(content, envKey, existing.join(','));
    writeFileSync(configPath, updatedContent, 'utf-8');

    return { added, mods: existing };
  }

  /**
   * Remove a mod from a server's configuration
   * Searches across all registered sources
   * Returns the source name if found, null if not found
   */
  removeMod(serverName: string, slug: string): { removed: boolean; sourceName: string } {
    const configPath = this.getConfigPath(serverName);
    const content = readFileSync(configPath, 'utf-8');
    const envMap = parseEnvFile(content);

    let updatedContent = content;

    for (const adapter of ModSourceFactory.getAllAdapters()) {
      const envKey = adapter.getEnvKey();
      const value = envMap.get(envKey);
      if (!value) continue;

      const mods = parseModList(value);
      const index = mods.indexOf(slug);
      if (index !== -1) {
        mods.splice(index, 1);
        updatedContent = updateEnvFile(updatedContent, envKey, mods.join(','));
        writeFileSync(configPath, updatedContent, 'utf-8');
        return { removed: true, sourceName: adapter.sourceName };
      }
    }

    return { removed: false, sourceName: 'unknown' };
  }
}

/**
 * Create a ModConfigService instance
 */
export function createModConfigService(platformPath: string): ModConfigService {
  return new ModConfigService(platformPath);
}
