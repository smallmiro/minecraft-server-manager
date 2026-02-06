import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { ServerConfig, UpdateServerConfigRequest } from '../schemas/config.js';

/**
 * Mapping between API field names and config.env variable names
 */
const CONFIG_FIELD_MAP: Record<keyof ServerConfig, string> = {
  motd: 'MOTD',
  maxPlayers: 'MAX_PLAYERS',
  difficulty: 'DIFFICULTY',
  gameMode: 'GAMEMODE',
  pvp: 'PVP',
  viewDistance: 'VIEW_DISTANCE',
  spawnProtection: 'SPAWN_PROTECTION',
  memory: 'MEMORY',
  useAikarFlags: 'USE_AIKAR_FLAGS',
};

/**
 * Fields that require a server restart to take effect
 */
const RESTART_REQUIRED_FIELDS: (keyof ServerConfig)[] = [
  'memory',
  'useAikarFlags',
];

/**
 * Parse config.env file content into key-value pairs
 */
function parseEnvFile(content: string): Map<string, string> {
  const result = new Map<string, string>();
  const lines = content.split('\n');

  for (const line of lines) {
    // Skip empty lines and comments
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Parse KEY=VALUE
    const eqIndex = line.indexOf('=');
    if (eqIndex > 0) {
      const key = line.substring(0, eqIndex).trim();
      const value = line.substring(eqIndex + 1).trim();
      result.set(key, value);
    }
  }

  return result;
}

/**
 * Convert env value to appropriate type for API response
 */
function parseEnvValue(key: keyof ServerConfig, value: string | undefined): ServerConfig[keyof ServerConfig] {
  if (value === undefined) {
    return undefined;
  }

  switch (key) {
    case 'maxPlayers':
    case 'viewDistance':
    case 'spawnProtection':
      const num = parseInt(value, 10);
      return isNaN(num) ? undefined : num;

    case 'pvp':
    case 'useAikarFlags':
      return value.toLowerCase() === 'true';

    case 'difficulty':
      const lowerDiff = value.toLowerCase();
      if (['peaceful', 'easy', 'normal', 'hard'].includes(lowerDiff)) {
        return lowerDiff as ServerConfig['difficulty'];
      }
      return undefined;

    case 'gameMode':
      const lowerMode = value.toLowerCase();
      if (['survival', 'creative', 'adventure', 'spectator'].includes(lowerMode)) {
        return lowerMode as ServerConfig['gameMode'];
      }
      return undefined;

    case 'motd':
    case 'memory':
      return value;

    default:
      return value;
  }
}

/**
 * Convert API value to env file format
 */
function formatEnvValue(key: keyof ServerConfig, value: ServerConfig[keyof ServerConfig]): string {
  if (value === undefined || value === null) {
    return '';
  }

  switch (key) {
    case 'pvp':
    case 'useAikarFlags':
      return value ? 'true' : 'false';

    case 'difficulty':
    case 'gameMode':
      return String(value).toLowerCase();

    default:
      return String(value);
  }
}

/**
 * Update config.env file while preserving comments and structure
 */
function updateEnvFile(content: string, updates: Map<string, string>): string {
  const lines = content.split('\n');
  const result: string[] = [];
  const updatedKeys = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();

    // Preserve empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      result.push(line);
      continue;
    }

    // Check if this line has a key we want to update
    const eqIndex = line.indexOf('=');
    if (eqIndex > 0) {
      const key = line.substring(0, eqIndex).trim();

      if (updates.has(key)) {
        const newValue = updates.get(key)!;
        result.push(`${key}=${newValue}`);
        updatedKeys.add(key);
      } else {
        result.push(line);
      }
    } else {
      result.push(line);
    }
  }

  // Add any new keys that weren't in the original file
  for (const [key, value] of updates) {
    if (!updatedKeys.has(key)) {
      // Find appropriate section or add at end
      result.push(`${key}=${value}`);
    }
  }

  return result.join('\n');
}

/**
 * ConfigService - Manages server configuration files
 */
export class ConfigService {
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
   * Read server configuration from config.env
   */
  getConfig(serverName: string): ServerConfig {
    const configPath = this.getConfigPath(serverName);

    if (!existsSync(configPath)) {
      throw new Error(`Server configuration not found: ${serverName}`);
    }

    const content = readFileSync(configPath, 'utf-8');
    const envMap = parseEnvFile(content);

    const config: ServerConfig = {};

    for (const [apiKey, envKey] of Object.entries(CONFIG_FIELD_MAP)) {
      const value = envMap.get(envKey);
      const parsedValue = parseEnvValue(apiKey as keyof ServerConfig, value);
      if (parsedValue !== undefined) {
        (config as Record<string, unknown>)[apiKey] = parsedValue;
      }
    }

    return config;
  }

  /**
   * Update server configuration in config.env
   * Returns information about what was changed
   */
  updateConfig(
    serverName: string,
    updates: UpdateServerConfigRequest
  ): {
    config: ServerConfig;
    changedFields: string[];
    restartRequired: boolean;
  } {
    const configPath = this.getConfigPath(serverName);

    if (!existsSync(configPath)) {
      throw new Error(`Server configuration not found: ${serverName}`);
    }

    // Read current configuration
    const content = readFileSync(configPath, 'utf-8');
    const currentConfig = this.getConfig(serverName);

    // Prepare updates
    const envUpdates = new Map<string, string>();
    const changedFields: string[] = [];
    let restartRequired = false;

    for (const [apiKey, value] of Object.entries(updates)) {
      if (value === undefined) {
        continue;
      }

      const typedKey = apiKey as keyof ServerConfig;
      const envKey = CONFIG_FIELD_MAP[typedKey];

      if (!envKey) {
        continue;
      }

      // Check if value actually changed
      const currentValue = currentConfig[typedKey];
      if (currentValue !== value) {
        changedFields.push(apiKey);
        envUpdates.set(envKey, formatEnvValue(typedKey, value));

        // Check if this field requires restart
        if (RESTART_REQUIRED_FIELDS.includes(typedKey)) {
          restartRequired = true;
        }
      }
    }

    // Only write if there are changes
    if (changedFields.length > 0) {
      const updatedContent = updateEnvFile(content, envUpdates);
      writeFileSync(configPath, updatedContent, 'utf-8');
    }

    // Read back the updated configuration
    const newConfig = this.getConfig(serverName);

    return {
      config: newConfig,
      changedFields,
      restartRequired,
    };
  }

  /**
   * Get the world name from server configuration
   */
  getWorldName(serverName: string): string {
    const configPath = this.getConfigPath(serverName);

    if (!existsSync(configPath)) {
      return 'world'; // Default world name
    }

    const content = readFileSync(configPath, 'utf-8');
    const envMap = parseEnvFile(content);

    return envMap.get('LEVEL') || 'world';
  }
}

/**
 * Create a ConfigService instance
 */
export function createConfigService(platformPath: string): ConfigService {
  return new ConfigService(platformPath);
}
