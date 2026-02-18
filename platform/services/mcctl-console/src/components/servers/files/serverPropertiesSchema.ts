export interface PropertySchema {
  key: string;
  type: 'boolean' | 'enum' | 'number' | 'string' | 'readonly';
  category: PropertyCategory;
  label: string;
  description: string;
  defaultValue: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

export type PropertyCategory = 'gameplay' | 'world' | 'network' | 'performance' | 'advanced';

export const categoryConfig: Record<PropertyCategory, { label: string; description: string }> = {
  gameplay: { label: 'Gameplay', description: 'Game rules, player limits, and core mechanics' },
  world: { label: 'World Generation', description: 'World settings, level name, and generation options' },
  network: { label: 'Network & Security', description: 'Ports, authentication, RCON, and query settings' },
  performance: { label: 'Performance', description: 'View distance, tick settings, and compression' },
  advanced: { label: 'Advanced', description: 'Other server properties' },
};

export const categoryOrder: PropertyCategory[] = ['gameplay', 'world', 'network', 'performance', 'advanced'];

export const serverPropertiesSchema: PropertySchema[] = [
  // === Gameplay ===
  {
    key: 'gamemode',
    type: 'enum',
    category: 'gameplay',
    label: 'Game Mode',
    description: 'Default game mode for new players',
    defaultValue: 'survival',
    options: [
      { value: 'survival', label: 'Survival' },
      { value: 'creative', label: 'Creative' },
      { value: 'adventure', label: 'Adventure' },
      { value: 'spectator', label: 'Spectator' },
    ],
  },
  {
    key: 'difficulty',
    type: 'enum',
    category: 'gameplay',
    label: 'Difficulty',
    description: 'Server difficulty level',
    defaultValue: 'easy',
    options: [
      { value: 'peaceful', label: 'Peaceful' },
      { value: 'easy', label: 'Easy' },
      { value: 'normal', label: 'Normal' },
      { value: 'hard', label: 'Hard' },
    ],
  },
  {
    key: 'hardcore',
    type: 'boolean',
    category: 'gameplay',
    label: 'Hardcore',
    description: 'Players are set to spectator mode on death',
    defaultValue: 'false',
  },
  {
    key: 'pvp',
    type: 'boolean',
    category: 'gameplay',
    label: 'PvP',
    description: 'Allow player vs player combat',
    defaultValue: 'true',
  },
  {
    key: 'max-players',
    type: 'number',
    category: 'gameplay',
    label: 'Max Players',
    description: 'Maximum number of players on the server',
    defaultValue: '20',
    min: 0,
    max: 2147483647,
  },
  {
    key: 'force-gamemode',
    type: 'boolean',
    category: 'gameplay',
    label: 'Force Game Mode',
    description: 'Force players to join in the default game mode',
    defaultValue: 'false',
  },
  {
    key: 'allow-flight',
    type: 'boolean',
    category: 'gameplay',
    label: 'Allow Flight',
    description: 'Allow players to use flight in survival mode',
    defaultValue: 'false',
  },
  {
    key: 'spawn-protection',
    type: 'number',
    category: 'gameplay',
    label: 'Spawn Protection',
    description: 'Radius of spawn protection area (0 = disabled)',
    defaultValue: '16',
    min: 0,
    max: 65536,
  },
  {
    key: 'spawn-animals',
    type: 'boolean',
    category: 'gameplay',
    label: 'Spawn Animals',
    description: 'Allow animals to spawn naturally',
    defaultValue: 'true',
  },
  {
    key: 'spawn-monsters',
    type: 'boolean',
    category: 'gameplay',
    label: 'Spawn Monsters',
    description: 'Allow hostile mobs to spawn naturally',
    defaultValue: 'true',
  },
  {
    key: 'spawn-npcs',
    type: 'boolean',
    category: 'gameplay',
    label: 'Spawn NPCs',
    description: 'Allow villagers to spawn',
    defaultValue: 'true',
  },
  {
    key: 'allow-nether',
    type: 'boolean',
    category: 'gameplay',
    label: 'Allow Nether',
    description: 'Allow players to travel to the Nether',
    defaultValue: 'true',
  },
  {
    key: 'enable-command-block',
    type: 'boolean',
    category: 'gameplay',
    label: 'Enable Command Blocks',
    description: 'Allow command blocks to be used',
    defaultValue: 'false',
  },
  {
    key: 'player-idle-timeout',
    type: 'number',
    category: 'gameplay',
    label: 'Player Idle Timeout',
    description: 'Kick idle players after N minutes (0 = disabled)',
    defaultValue: '0',
    min: 0,
    max: 2147483647,
  },

  // === World Generation ===
  {
    key: 'level-name',
    type: 'string',
    category: 'world',
    label: 'Level Name',
    description: 'Name of the world folder',
    defaultValue: 'world',
  },
  {
    key: 'level-seed',
    type: 'string',
    category: 'world',
    label: 'Level Seed',
    description: 'Seed for world generation (blank = random)',
    defaultValue: '',
  },
  {
    key: 'level-type',
    type: 'enum',
    category: 'world',
    label: 'Level Type',
    description: 'World generation type',
    defaultValue: 'minecraft\\:normal',
    options: [
      { value: 'minecraft\\:normal', label: 'Normal' },
      { value: 'minecraft\\:flat', label: 'Flat' },
      { value: 'minecraft\\:large_biomes', label: 'Large Biomes' },
      { value: 'minecraft\\:amplified', label: 'Amplified' },
      { value: 'minecraft\\:single_biome_surface', label: 'Single Biome' },
    ],
  },
  {
    key: 'generate-structures',
    type: 'boolean',
    category: 'world',
    label: 'Generate Structures',
    description: 'Generate villages, temples, and other structures',
    defaultValue: 'true',
  },
  {
    key: 'max-world-size',
    type: 'number',
    category: 'world',
    label: 'Max World Size',
    description: 'Maximum world border radius in blocks',
    defaultValue: '29999984',
    min: 1,
    max: 29999984,
  },
  {
    key: 'generator-settings',
    type: 'string',
    category: 'world',
    label: 'Generator Settings',
    description: 'Custom world generator settings (JSON)',
    defaultValue: '{}',
  },
  {
    key: 'motd',
    type: 'string',
    category: 'world',
    label: 'MOTD',
    description: 'Message displayed in the server list',
    defaultValue: 'A Minecraft Server',
  },

  // === Network & Security ===
  {
    key: 'server-port',
    type: 'readonly',
    category: 'network',
    label: 'Server Port',
    description: 'Port the server listens on (cannot be changed at runtime)',
    defaultValue: '25565',
  },
  {
    key: 'server-ip',
    type: 'readonly',
    category: 'network',
    label: 'Server IP',
    description: 'IP address to bind to (blank = all interfaces)',
    defaultValue: '',
  },
  {
    key: 'online-mode',
    type: 'boolean',
    category: 'network',
    label: 'Online Mode',
    description: 'Authenticate players with Mojang servers',
    defaultValue: 'true',
  },
  {
    key: 'white-list',
    type: 'boolean',
    category: 'network',
    label: 'Whitelist',
    description: 'Only allow whitelisted players to join',
    defaultValue: 'false',
  },
  {
    key: 'enforce-whitelist',
    type: 'boolean',
    category: 'network',
    label: 'Enforce Whitelist',
    description: 'Kick non-whitelisted players when whitelist is reloaded',
    defaultValue: 'false',
  },
  {
    key: 'enforce-secure-profile',
    type: 'boolean',
    category: 'network',
    label: 'Enforce Secure Profile',
    description: 'Require players to have a signed key from Mojang',
    defaultValue: 'true',
  },
  {
    key: 'enable-rcon',
    type: 'boolean',
    category: 'network',
    label: 'Enable RCON',
    description: 'Enable remote console access',
    defaultValue: 'false',
  },
  {
    key: 'rcon.port',
    type: 'number',
    category: 'network',
    label: 'RCON Port',
    description: 'Port for RCON connections',
    defaultValue: '25575',
    min: 1,
    max: 65535,
  },
  {
    key: 'rcon.password',
    type: 'string',
    category: 'network',
    label: 'RCON Password',
    description: 'Password for RCON authentication',
    defaultValue: '',
  },
  {
    key: 'enable-query',
    type: 'boolean',
    category: 'network',
    label: 'Enable Query',
    description: 'Enable GameSpy4 protocol server listener',
    defaultValue: 'false',
  },
  {
    key: 'query.port',
    type: 'number',
    category: 'network',
    label: 'Query Port',
    description: 'Port for query protocol',
    defaultValue: '25565',
    min: 1,
    max: 65535,
  },
  {
    key: 'enable-status',
    type: 'boolean',
    category: 'network',
    label: 'Enable Status',
    description: 'Show server in the server list',
    defaultValue: 'true',
  },
  {
    key: 'prevent-proxy-connections',
    type: 'boolean',
    category: 'network',
    label: 'Prevent Proxy Connections',
    description: 'Block VPN/proxy connections (requires online-mode)',
    defaultValue: 'false',
  },
  {
    key: 'hide-online-players',
    type: 'boolean',
    category: 'network',
    label: 'Hide Online Players',
    description: 'Hide player count and list in server status',
    defaultValue: 'false',
  },

  // === Performance ===
  {
    key: 'view-distance',
    type: 'number',
    category: 'performance',
    label: 'View Distance',
    description: 'Render distance in chunks sent to players',
    defaultValue: '10',
    min: 3,
    max: 32,
  },
  {
    key: 'simulation-distance',
    type: 'number',
    category: 'performance',
    label: 'Simulation Distance',
    description: 'Distance in chunks for entity simulation',
    defaultValue: '10',
    min: 3,
    max: 32,
  },
  {
    key: 'max-tick-time',
    type: 'number',
    category: 'performance',
    label: 'Max Tick Time',
    description: 'Maximum tick duration before watchdog crash (ms, -1 = disabled)',
    defaultValue: '60000',
    min: -1,
    max: 2147483647,
  },
  {
    key: 'network-compression-threshold',
    type: 'number',
    category: 'performance',
    label: 'Network Compression Threshold',
    description: 'Minimum packet size to compress (bytes, -1 = disabled)',
    defaultValue: '256',
    min: -1,
    max: 2147483647,
  },
  {
    key: 'max-chained-neighbor-updates',
    type: 'number',
    category: 'performance',
    label: 'Max Chained Neighbor Updates',
    description: 'Limit for chained block updates (-1 = unlimited)',
    defaultValue: '1000000',
    min: -1,
    max: 2147483647,
  },
  {
    key: 'rate-limit',
    type: 'number',
    category: 'performance',
    label: 'Rate Limit',
    description: 'Max packets per second before kick (0 = disabled)',
    defaultValue: '0',
    min: 0,
    max: 2147483647,
  },
  {
    key: 'entity-broadcast-range-percentage',
    type: 'number',
    category: 'performance',
    label: 'Entity Broadcast Range',
    description: 'Percentage of default entity visibility range',
    defaultValue: '100',
    min: 10,
    max: 1000,
  },

  // === Advanced ===
  {
    key: 'resource-pack',
    type: 'string',
    category: 'advanced',
    label: 'Resource Pack URL',
    description: 'URL of the server resource pack',
    defaultValue: '',
  },
  {
    key: 'resource-pack-sha1',
    type: 'string',
    category: 'advanced',
    label: 'Resource Pack SHA1',
    description: 'SHA1 hash of the resource pack file',
    defaultValue: '',
  },
  {
    key: 'require-resource-pack',
    type: 'boolean',
    category: 'advanced',
    label: 'Require Resource Pack',
    description: 'Kick players who decline the resource pack',
    defaultValue: 'false',
  },
  {
    key: 'resource-pack-prompt',
    type: 'string',
    category: 'advanced',
    label: 'Resource Pack Prompt',
    description: 'Custom message shown when asking to download resource pack',
    defaultValue: '',
  },
  {
    key: 'function-permission-level',
    type: 'enum',
    category: 'advanced',
    label: 'Function Permission Level',
    description: 'OP level required to execute functions',
    defaultValue: '2',
    options: [
      { value: '1', label: 'Level 1 - Moderator' },
      { value: '2', label: 'Level 2 - Gamemaster' },
      { value: '3', label: 'Level 3 - Admin' },
      { value: '4', label: 'Level 4 - Owner' },
    ],
  },
  {
    key: 'op-permission-level',
    type: 'enum',
    category: 'advanced',
    label: 'OP Permission Level',
    description: 'Default OP level for new operators',
    defaultValue: '4',
    options: [
      { value: '1', label: 'Level 1 - Moderator' },
      { value: '2', label: 'Level 2 - Gamemaster' },
      { value: '3', label: 'Level 3 - Admin' },
      { value: '4', label: 'Level 4 - Owner' },
    ],
  },
  {
    key: 'text-filtering-config',
    type: 'string',
    category: 'advanced',
    label: 'Text Filtering Config',
    description: 'Text filtering configuration file',
    defaultValue: '',
  },
  {
    key: 'log-ips',
    type: 'boolean',
    category: 'advanced',
    label: 'Log IPs',
    description: 'Log player IP addresses in the server log',
    defaultValue: 'true',
  },
  {
    key: 'broadcast-console-to-ops',
    type: 'boolean',
    category: 'advanced',
    label: 'Broadcast Console to OPs',
    description: 'Send console output to all OPs',
    defaultValue: 'true',
  },
  {
    key: 'broadcast-rcon-to-ops',
    type: 'boolean',
    category: 'advanced',
    label: 'Broadcast RCON to OPs',
    description: 'Send RCON output to all OPs',
    defaultValue: 'true',
  },
  {
    key: 'sync-chunk-writes',
    type: 'boolean',
    category: 'advanced',
    label: 'Sync Chunk Writes',
    description: 'Synchronize chunk writes for data safety',
    defaultValue: 'true',
  },
  {
    key: 'enable-jmx-monitoring',
    type: 'boolean',
    category: 'advanced',
    label: 'Enable JMX Monitoring',
    description: 'Expose JMX metrics for monitoring',
    defaultValue: 'false',
  },
  {
    key: 'use-native-transport',
    type: 'boolean',
    category: 'advanced',
    label: 'Use Native Transport',
    description: 'Use Linux-specific packet optimizations',
    defaultValue: 'true',
  },
  {
    key: 'initial-enabled-packs',
    type: 'string',
    category: 'advanced',
    label: 'Initial Enabled Packs',
    description: 'Comma-separated list of initially enabled data packs',
    defaultValue: 'vanilla',
  },
  {
    key: 'initial-disabled-packs',
    type: 'string',
    category: 'advanced',
    label: 'Initial Disabled Packs',
    description: 'Comma-separated list of initially disabled data packs',
    defaultValue: '',
  },
];

const schemaMap = new Map(serverPropertiesSchema.map((s) => [s.key, s]));

export function getPropertySchema(key: string): PropertySchema | undefined {
  return schemaMap.get(key);
}

export function parseServerProperties(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.substring(0, eqIndex).trim();
    const value = trimmed.substring(eqIndex + 1).trim();
    result[key] = value;
  }
  return result;
}

export function serializeServerProperties(
  originalContent: string,
  values: Record<string, string>,
): string {
  const lines = originalContent.split('\n');
  const usedKeys = new Set<string>();

  const updatedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return line;
    const key = trimmed.substring(0, eqIndex).trim();
    usedKeys.add(key);
    if (key in values) {
      return `${key}=${values[key]}`;
    }
    return line;
  });

  // Append new keys that didn't exist in the original
  for (const [key, value] of Object.entries(values)) {
    if (!usedKeys.has(key)) {
      updatedLines.push(`${key}=${value}`);
    }
  }

  return updatedLines.join('\n');
}
