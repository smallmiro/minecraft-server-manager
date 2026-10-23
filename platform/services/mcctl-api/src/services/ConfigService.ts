import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { resolveWorldName } from '@minecraft-docker/shared';
import { applyEnvChanges, assertEnvFileValue, atomicWriteFileSync, parseEnvDocument } from '@minecraft-docker/shared/utils';
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

  // Native Auto-pause (MC 1.21.2+)
  pauseWhenEmptySeconds: 'PAUSE_WHEN_EMPTY_SECONDS',

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

  // Remote Access
  websocketConsole: 'WEBSOCKET_CONSOLE',
  websocketAddress: 'WEBSOCKET_ADDRESS',
  websocketPassword: 'WEBSOCKET_PASSWORD',
  websocketDisableAuthentication: 'WEBSOCKET_DISABLE_AUTHENTICATION',
  websocketAllowedOrigins: 'WEBSOCKET_ALLOWED_ORIGINS',
  websocketLogBufferSize: 'WEBSOCKET_LOG_BUFFER_SIZE',
  enableSsh: 'ENABLE_SSH',
  // Configuration Repositories
  paperConfigRepo: 'PAPER_CONFIG_REPO',
  pufferfishConfigRepo: 'PUFFERFISH_CONFIG_REPO',
  purpurConfigRepo: 'PURPUR_CONFIG_REPO',
  serverPropertiesRepoUrl: 'SERVER_PROPERTIES_REPO_URL',
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
  // Native Auto-pause (MC 1.21.2+)
  'pauseWhenEmptySeconds',
  // RCON
  'enableRcon',
  'rconPassword',
  'rconPort',
  // System
  'tz',
  'uid',
  'gid',
  'stopDuration',
  // Remote Access
  'websocketConsole',
  'enableSsh',
  // Configuration Repositories (applied at container startup)
  'paperConfigRepo',
  'pufferfishConfigRepo',
  'purpurConfigRepo',
  'serverPropertiesRepoUrl',
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
  'websocketConsole',
  'websocketDisableAuthentication',
  'enableSsh',
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
  'pauseWhenEmptySeconds',
  'rconPort',
  'stopDuration',
  'uid',
  'gid',
  'websocketLogBufferSize',
];

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

  // levelType: camelCase → env format
  if (key === 'levelType') {
    const map: Record<string, string> = {
      default: 'DEFAULT',
      flat: 'FLAT',
      largeBiomes: 'LARGEBIOMES',
      amplified: 'AMPLIFIED',
      buffet: 'BUFFET',
    };
    return map[String(value)] ?? String(value);
  }

  return String(value);
}

/**
 * ConfigService - Manages server configuration files
 */
export class ConfigService {
  private readonly mcctlRoot: string;

  constructor(mcctlRoot: string) {
    this.mcctlRoot = mcctlRoot;
  }

  /**
   * Get the path to a server's config.env file
   */
  private getConfigPath(serverName: string): string {
    return join(this.mcctlRoot, 'servers', serverName, 'config.env');
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
    const envMap = parseEnvDocument(content).values;

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
      // User input: one line, no control character, no leading quote (#726)
      for (const [envKey, value] of envUpdates) assertEnvFileValue(envKey, value);
      const updatedContent = applyEnvChanges(content, { set: Object.fromEntries(envUpdates) }, { raw: true });
      atomicWriteFileSync(configPath, updatedContent);
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
      return resolveWorldName({});
    }

    const content = readFileSync(configPath, 'utf-8');

    return resolveWorldName(Object.fromEntries(parseEnvDocument(content).values));
  }
}

/**
 * Create a ConfigService instance
 */
export function createConfigService(mcctlRoot: string): ConfigService {
  return new ConfigService(mcctlRoot);
}
