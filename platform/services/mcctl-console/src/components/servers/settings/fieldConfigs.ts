import type { ServerConfig } from '@/ports/api/IMcctlApiClient';

export type FieldType = 'boolean' | 'select' | 'number' | 'string' | 'password';

export interface SelectOption {
  value: string;
  label: string;
}

export interface FieldConfig {
  key: keyof ServerConfig;
  label: string;
  type: FieldType;
  helperText?: string;
  restartRequired?: boolean;
  options?: SelectOption[];
  validation?: {
    min?: number;
    max?: number;
  };
  unit?: string;
  columns?: 6 | 12;
}

// ── Gameplay: Essential ──
export const gameplayEssentialFields: FieldConfig[] = [
  {
    key: 'difficulty',
    label: 'Difficulty',
    type: 'select',
    options: [
      { value: 'peaceful', label: 'Peaceful' },
      { value: 'easy', label: 'Easy' },
      { value: 'normal', label: 'Normal' },
      { value: 'hard', label: 'Hard' },
    ],
  },
  {
    key: 'gameMode',
    label: 'Game Mode',
    type: 'select',
    options: [
      { value: 'survival', label: 'Survival' },
      { value: 'creative', label: 'Creative' },
      { value: 'adventure', label: 'Adventure' },
      { value: 'spectator', label: 'Spectator' },
    ],
  },
  {
    key: 'maxPlayers',
    label: 'Max Players',
    type: 'number',
    validation: { min: 1, max: 1000 },
  },
  {
    key: 'pvp',
    label: 'Enable PvP',
    type: 'boolean',
    helperText: 'Allow players to damage each other',
  },
];

// ── Gameplay: Advanced ──
export const gameplayAdvancedFields: FieldConfig[] = [
  {
    key: 'forceGamemode',
    label: 'Force Game Mode',
    type: 'boolean',
    helperText: 'Force game mode when players join',
  },
  {
    key: 'hardcore',
    label: 'Hardcore',
    type: 'boolean',
    helperText: 'One life only - world deleted on death',
  },
  {
    key: 'allowFlight',
    label: 'Allow Flight',
    type: 'boolean',
    helperText: 'Allow flight in survival mode',
  },
  {
    key: 'allowNether',
    label: 'Allow Nether',
    type: 'boolean',
    helperText: 'Enable Nether portal access',
  },
  {
    key: 'enableCommandBlock',
    label: 'Command Blocks',
    type: 'boolean',
    helperText: 'Enable command block functionality',
  },
  {
    key: 'spawnProtection',
    label: 'Spawn Protection',
    type: 'number',
    helperText: 'Radius around spawn (0 = disabled)',
    unit: 'blocks',
    validation: { min: 0, max: 256 },
  },
  {
    key: 'spawnAnimals',
    label: 'Spawn Animals',
    type: 'boolean',
    helperText: 'Spawn passive mobs (cows, pigs, etc.)',
  },
  {
    key: 'spawnMonsters',
    label: 'Spawn Monsters',
    type: 'boolean',
    helperText: 'Spawn hostile mobs (zombies, creepers, etc.)',
  },
  {
    key: 'spawnNpcs',
    label: 'Spawn NPCs',
    type: 'boolean',
    helperText: 'Spawn villagers and wandering traders',
  },
];

// ── World: Essential ──
export const worldEssentialFields: FieldConfig[] = [
  {
    key: 'motd',
    label: 'MOTD (Message of the Day)',
    type: 'string',
    helperText: 'Displayed in the server list',
    columns: 12,
  },
  {
    key: 'level',
    label: 'World Name',
    type: 'string',
    helperText: 'Save folder name',
    restartRequired: true,
  },
  {
    key: 'levelType',
    label: 'Level Type',
    type: 'select',
    restartRequired: true,
    options: [
      { value: 'default', label: 'Default' },
      { value: 'flat', label: 'Flat' },
      { value: 'largeBiomes', label: 'Large Biomes' },
      { value: 'amplified', label: 'Amplified' },
      { value: 'buffet', label: 'Buffet' },
    ],
  },
  {
    key: 'seed',
    label: 'World Seed',
    type: 'string',
    helperText: 'Only affects new world generation',
    restartRequired: true,
  },
];

// ── World: Advanced ──
export const worldAdvancedFields: FieldConfig[] = [
  {
    key: 'generateStructures',
    label: 'Generate Structures',
    type: 'boolean',
    helperText: 'Generate villages, temples, etc.',
  },
  {
    key: 'maxWorldSize',
    label: 'Max World Size',
    type: 'number',
    unit: 'blocks',
    helperText: 'Maximum world radius',
    validation: { min: 1, max: 29999984 },
  },
  {
    key: 'icon',
    label: 'Server Icon URL',
    type: 'string',
    helperText: '64x64 PNG image URL',
    columns: 12,
  },
];

// ── Security: Essential ──
export const securityEssentialFields: FieldConfig[] = [
  {
    key: 'onlineMode',
    label: 'Online Mode (Mojang Auth)',
    type: 'boolean',
    helperText: 'Disable to allow cracked clients (not recommended)',
    restartRequired: true,
  },
  {
    key: 'enableWhitelist',
    label: 'Enable Whitelist',
    type: 'boolean',
    helperText: 'Only whitelisted players can join',
    restartRequired: true,
  },
];

// ── Security: Advanced ──
export const securityAdvancedFields: FieldConfig[] = [
  {
    key: 'enforceWhitelist',
    label: 'Enforce Whitelist',
    type: 'boolean',
    helperText: 'Kick non-whitelisted players already online',
    restartRequired: true,
  },
  {
    key: 'enforceSecureProfile',
    label: 'Enforce Secure Profile',
    type: 'boolean',
    helperText: 'Require signed chat messages from players',
    restartRequired: true,
  },
];

// ── Performance: Essential ──
export const performanceEssentialFields: FieldConfig[] = [
  {
    key: 'memory',
    label: 'Memory',
    type: 'string',
    helperText: 'e.g., 2G, 4G, 8G',
    restartRequired: true,
  },
  {
    key: 'useAikarFlags',
    label: "Aikar's Flags",
    type: 'boolean',
    helperText: 'Optimized GC flags for Paper/Spigot',
    restartRequired: true,
  },
  {
    key: 'viewDistance',
    label: 'View Distance',
    type: 'number',
    unit: 'chunks',
    validation: { min: 2, max: 32 },
  },
];

// ── Performance: Advanced ──
export const performanceAdvancedFields: FieldConfig[] = [
  {
    key: 'simulationDistance',
    label: 'Simulation Distance',
    type: 'number',
    unit: 'chunks',
    validation: { min: 3, max: 32 },
  },
  {
    key: 'maxTickTime',
    label: 'Max Tick Time',
    type: 'number',
    unit: 'ms',
    helperText: '-1 to disable watchdog',
    validation: { min: -1 },
  },
  {
    key: 'initMemory',
    label: 'Initial Heap',
    type: 'string',
    helperText: 'e.g., 1G (overrides Memory)',
    restartRequired: true,
  },
  {
    key: 'maxMemory',
    label: 'Max Heap',
    type: 'string',
    helperText: 'e.g., 8G (overrides Memory)',
    restartRequired: true,
  },
  {
    key: 'jvmXxOpts',
    label: 'JVM -XX Options',
    type: 'string',
    helperText: 'Additional -XX JVM flags',
    restartRequired: true,
    columns: 12,
  },
];

// ── Auto-pause: Essential ──
export const autopauseEssentialFields: FieldConfig[] = [
  {
    key: 'enableAutopause',
    label: 'Enable Auto-pause',
    type: 'boolean',
    helperText: 'Pause process when no players connected',
    restartRequired: true,
  },
  {
    key: 'autopauseTimeoutEst',
    label: 'Pause Timeout',
    type: 'number',
    unit: 'seconds',
    helperText: 'Wait time after last player leaves',
    validation: { min: 0 },
  },
];

// ── Auto-pause: Advanced ──
export const autopauseAdvancedFields: FieldConfig[] = [
  {
    key: 'autopauseTimeoutInit',
    label: 'Init Timeout',
    type: 'number',
    unit: 'seconds',
    helperText: 'Timeout after start without connections',
    validation: { min: 0 },
  },
  {
    key: 'autopausePeriod',
    label: 'Check Period',
    type: 'number',
    unit: 'seconds',
    helperText: 'Status check interval',
    validation: { min: 1 },
  },
  {
    key: 'enableAutostop',
    label: 'Enable Auto-stop',
    type: 'boolean',
    helperText: 'Stop container when no players connected',
    restartRequired: true,
  },
  {
    key: 'autostopTimeoutEst',
    label: 'Stop Timeout',
    type: 'number',
    unit: 'seconds',
    helperText: 'Wait time before stopping container',
    validation: { min: 0 },
  },
];

// ── System: Essential ──
export const systemEssentialFields: FieldConfig[] = [
  {
    key: 'tz',
    label: 'Timezone',
    type: 'string',
    helperText: 'e.g., Asia/Seoul, UTC',
    restartRequired: true,
  },
  {
    key: 'resourcePack',
    label: 'Resource Pack URL',
    type: 'string',
    helperText: 'Direct download URL for resource pack',
    columns: 12,
  },
  {
    key: 'enableRcon',
    label: 'Enable RCON',
    type: 'boolean',
    helperText: 'Remote server console access',
    restartRequired: true,
  },
];

// ── System: Advanced ──
export const systemAdvancedFields: FieldConfig[] = [
  {
    key: 'resourcePackSha1',
    label: 'Resource Pack SHA1',
    type: 'string',
    helperText: '40-character hex checksum',
    columns: 12,
  },
  {
    key: 'resourcePackEnforce',
    label: 'Enforce Resource Pack',
    type: 'boolean',
    helperText: 'Kick players who decline',
  },
  {
    key: 'resourcePackPrompt',
    label: 'Resource Pack Prompt',
    type: 'string',
    helperText: 'Custom message for resource pack dialog',
    columns: 12,
  },
  {
    key: 'rconPassword',
    label: 'RCON Password',
    type: 'password',
    restartRequired: true,
  },
  {
    key: 'rconPort',
    label: 'RCON Port',
    type: 'number',
    validation: { min: 1024, max: 65535 },
    restartRequired: true,
  },
  {
    key: 'stopDuration',
    label: 'Stop Timeout',
    type: 'number',
    unit: 'seconds',
    helperText: 'Graceful shutdown wait time',
    restartRequired: true,
    validation: { min: 0 },
  },
  {
    key: 'uid',
    label: 'User ID (UID)',
    type: 'number',
    helperText: 'Container process UID',
    restartRequired: true,
    validation: { min: 0 },
  },
  {
    key: 'gid',
    label: 'Group ID (GID)',
    type: 'number',
    helperText: 'Container process GID',
    restartRequired: true,
    validation: { min: 0 },
  },
];
