import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { ServerConfig, UpdateServerConfigRequest } from '../schemas/config.js';

/**
 * Mapping between API field names and config.env variable names
 */
const CONFIG_FIELD_MAP: Record<keyof ServerConfig, string> = {
  // Gameplay
  difficulty: 'DIFFICULTY',
  gameMode: 'GAMEMODE',
  maxPlayers: 'MAX_PLAYERS',
  pvp: 'PVP',
  forceGamemode: 'FORCE_GAMEMODE',
  hardcore: 'HARDCORE',
  allowFlight: 'ALLOW_FLIGHT',
  allowNether: 'ALLOW_NETHER',
  enableCommandBlock: 'ENABLE_COMMAND_BLOCK',
  spawnProtection: 'SPAWN_PROTECTION',
  spawnAnimals: 'SPAWN_ANIMALS',
  spawnMonsters: 'SPAWN_MONSTERS',
  spawnNpcs: 'SPAWN_NPCS',

  // World
  motd: 'MOTD',
  level: 'LEVEL',
  levelType: 'LEVEL_TYPE',
  seed: 'SEED',
  generateStructures: 'GENERATE_STRUCTURES',
  maxWorldSize: 'MAX_WORLD_SIZE',
  icon: 'ICON',

  // Security
  onlineMode: 'ONLINE_MODE',
  enableWhitelist: 'ENABLE_WHITELIST',
  enforceWhitelist: 'ENFORCE_WHITELIST',
  enforceSecureProfile: 'ENFORCE_SECURE_PROFILE',

  // Performance & JVM
  memory: 'MEMORY',
  useAikarFlags: 'USE_AIKAR_FLAGS',
  viewDistance: 'VIEW_DISTANCE',
  simulationDistance: 'SIMULATION_DISTANCE',
  maxTickTime: 'MAX_TICK_TIME',
  initMemory: 'INIT_MEMORY',
  maxMemory: 'MAX_MEMORY',
  jvmXxOpts: 'JVM_XX_OPTS',

  // Auto-pause / Auto-stop
  enableAutopause: 'ENABLE_AUTOPAUSE',
  autopauseTimeoutEst: 'AUTOPAUSE_TIMEOUT_EST',
  autopauseTimeoutInit: 'AUTOPAUSE_TIMEOUT_INIT',
  autopausePeriod: 'AUTOPAUSE_PERIOD',
  enableAutostop: 'ENABLE_AUTOSTOP',
  autostopTimeoutEst: 'AUTOSTOP_TIMEOUT_EST',

  // System
  tz: 'TZ',
  resourcePack: 'RESOURCE_PACK',
  enableRcon: 'ENABLE_RCON',
  resourcePackSha1: 'RESOURCE_PACK_SHA1',
  resourcePackEnforce: 'RESOURCE_PACK_ENFORCE',
  resourcePackPrompt: 'RESOURCE_PACK_PROMPT',
  rconPassword: 'RCON_PASSWORD',
  rconPort: 'RCON_PORT',
  stopDuration: 'STOP_DURATION',
  uid: 'UID',
  gid: 'GID',
};

/**
 * Fields that require a server restart to take effect
 */
const RESTART_REQUIRED_FIELDS: (keyof ServerConfig)[] = [
  // JVM / Docker-level
  'memory',
  'initMemory',
  'maxMemory',
  'useAikarFlags',
  'jvmXxOpts',
  // Security
  'onlineMode',
  'enableWhitelist',
  'enforceWhitelist',
  'enforceSecureProfile',
  // World generation (only on new world)
  'level',
  'seed',
  'levelType',
  // Auto-pause / Auto-stop
  'enableAutopause',
  'enableAutostop',
  // RCON
  'enableRcon',
  'rconPassword',
  'rconPort',
  // System
  'tz',
  'uid',
  'gid',
  'stopDuration',
];

/**
 * Boolean fields and their env file format (lowercase or UPPERCASE)
 */
const BOOLEAN_FIELDS_UPPERCASE: (keyof ServerConfig)[] = [
  'onlineMode',
  'enableWhitelist',
  'enforceWhitelist',
  'enforceSecureProfile',
];

const BOOLEAN_FIELDS: (keyof ServerConfig)[] = [
  'pvp',
  'useAikarFlags',
  'forceGamemode',
  'hardcore',
  'allowFlight',
  'allowNether',
  'enableCommandBlock',
  'spawnAnimals',
  'spawnMonsters',
  'spawnNpcs',
  'generateStructures',
  'enableAutopause',
  'enableAutostop',
  'enableRcon',
  'resourcePackEnforce',
];

/**
 * Number fields
 */
const NUMBER_FIELDS: (keyof ServerConfig)[] = [
  'maxPlayers',
  'viewDistance',
  'spawnProtection',
  'simulationDistance',
  'maxTickTime',
  'maxWorldSize',
  'autopauseTimeoutEst',
  'autopauseTimeoutInit',
  'autopausePeriod',
  'autostopTimeoutEst',
  'rconPort',
  'stopDuration',
  'uid',
  'gid',
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

  // Number fields
  if (NUMBER_FIELDS.includes(key)) {
    const num = parseInt(value, 10);
    return isNaN(num) ? undefined : num;
  }

  // Boolean fields (both uppercase and lowercase)
  if (BOOLEAN_FIELDS.includes(key) || BOOLEAN_FIELDS_UPPERCASE.includes(key)) {
    return value.toLowerCase() === 'true';
  }

  // Enum: difficulty
  if (key === 'difficulty') {
    const lower = value.toLowerCase();
    if (['peaceful', 'easy', 'normal', 'hard'].includes(lower)) {
      return lower as ServerConfig['difficulty'];
    }
    return undefined;
  }

  // Enum: gameMode
  if (key === 'gameMode') {
    const lower = value.toLowerCase();
    if (['survival', 'creative', 'adventure', 'spectator'].includes(lower)) {
      return lower as ServerConfig['gameMode'];
    }
    return undefined;
  }

  // Enum: levelType
  if (key === 'levelType') {
    const lower = value.toLowerCase();
    const map: Record<string, string> = {
      default: 'default',
      flat: 'flat',
      largebiomes: 'largeBiomes',
      amplified: 'amplified',
      buffet: 'buffet',
    };
    return (map[lower] as ServerConfig['levelType']) ?? undefined;
  }

  // String fields
  return value;
}

/**
 * Convert API value to env file format
 */
function formatEnvValue(key: keyof ServerConfig, value: ServerConfig[keyof ServerConfig]): string {
  if (value === undefined || value === null) {
    return '';
  }

  // Boolean uppercase (TRUE/FALSE)
  if (BOOLEAN_FIELDS_UPPERCASE.includes(key)) {
    return value ? 'TRUE' : 'FALSE';
  }

  // Boolean lowercase (true/false)
  if (BOOLEAN_FIELDS.includes(key)) {
    return value ? 'true' : 'false';
  }

  // Enums lowercase
  if (key === 'difficulty' || key === 'gameMode') {
    return String(value).toLowerCase();
  }

  return String(value);
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
