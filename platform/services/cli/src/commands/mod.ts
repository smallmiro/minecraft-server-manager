import {
  Paths,
  log,
  colors,
  ModSourceFactory,
  ServerType,
  type ModProject,
  type ServerTypeInfo,
} from '@minecraft-docker/shared';
// Auto-register mod source adapters
import '@minecraft-docker/mod-source-modrinth';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { parseEnvDocument } from '@minecraft-docker/shared/utils';
import { writeServerConfig } from '../lib/server-config.js';

/**
 * Mod command options
 */
export interface ModCommandOptions {
  root?: string;
  subCommand?: string;
  serverName?: string;
  modNames?: string[];
  query?: string;
  source?: 'modrinth' | 'curseforge' | 'spiget' | 'url';
  json?: boolean;
  force?: boolean;
}

/**
 * Execute mod management command
 */
export async function modCommand(options: ModCommandOptions): Promise<number> {
  const paths = new Paths(options.root);

  // Check if initialized
  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  const subCommand = options.subCommand ?? 'list';

  switch (subCommand) {
    case 'search':
      return modSearch(options);

    case 'add':
      return modAdd(paths, options);

    case 'list':
      return modList(paths, options);

    case 'remove':
      return modRemove(paths, options);

    case 'sources':
      return modSources(options);

    default:
      log.error(`Unknown mod subcommand: ${subCommand}`);
      console.log('Usage: mcctl mod [search|add|list|remove|sources]');
      return 1;
  }
}

/**
 * Search mods using ModSourceFactory
 */
async function modSearch(options: ModCommandOptions): Promise<number> {
  const query = options.query;
  const source = options.source ?? 'modrinth';

  if (!query) {
    log.error('Search query required');
    console.log('Usage: mcctl mod search <query>');
    return 1;
  }

  // Get the appropriate mod source adapter
  const adapter = ModSourceFactory.getOrNull(source);
  if (!adapter) {
    log.error(`Mod source '${source}' is not supported`);
    console.log(`Available sources: ${ModSourceFactory.getSupportedSources().join(', ')}`);
    return 1;
  }

  try {
    const result = await adapter.search(query, { limit: 15 });

    if (result.hits.length === 0) {
      console.log(`No mods found for "${query}" on ${adapter.displayName}`);
      return 0;
    }

    if (options.json) {
      console.log(JSON.stringify(result.hits, null, 2));
      return 0;
    }

    console.log('');
    console.log(colors.bold(`Search results for "${query}" on ${adapter.displayName} (${result.totalHits} total):`));
    console.log('');

    for (const mod of result.hits) {
      const downloads = formatDownloads(mod.downloads);
      const serverSide = mod.serverSide === 'required' ? colors.green('server') :
                        mod.serverSide === 'optional' ? colors.yellow('server?') : '';
      const clientSide = mod.clientSide === 'required' ? colors.blue('client') :
                        mod.clientSide === 'optional' ? colors.dim('client?') : '';
      const sides = [serverSide, clientSide].filter(Boolean).join(' ');

      console.log(`  ${colors.cyan(mod.slug)} ${colors.dim(`(${downloads} downloads)`)}`);
      console.log(`    ${mod.title} ${sides}`);
      console.log(`    ${colors.dim(mod.description.slice(0, 80))}${mod.description.length > 80 ? '...' : ''}`);
      console.log('');
    }

    console.log(colors.dim('Use: mcctl mod add <server> <mod-slug> to install'));
    console.log('');

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Search failed: ${message}`);
    return 1;
  }
}

/**
 * Add mod to server using ModSourceFactory
 */
async function modAdd(
  paths: Paths,
  options: ModCommandOptions
): Promise<number> {
  const { serverName, modNames, source = 'modrinth' } = options;

  if (!serverName) {
    log.error('Server name required');
    console.log('Usage: mcctl mod add <server> <mod...>');
    return 1;
  }

  if (!modNames || modNames.length === 0) {
    log.error('At least one mod name required');
    console.log('Usage: mcctl mod add <server> <mod...>');
    return 1;
  }

  // Check server exists
  const serverDir = join(paths.servers, serverName);
  const configPath = join(serverDir, 'config.env');

  if (!existsSync(configPath)) {
    log.error(`Server '${serverName}' not found`);
    return 1;
  }

  // Get the appropriate mod source adapter
  const adapter = ModSourceFactory.getOrNull(source);

  try {
    // Read current config
    const configContent = await readFile(configPath, 'utf-8');
    const config = Object.fromEntries(parseEnvDocument(configContent).values);

    // Check server type supports mods
    const serverType = config['TYPE'] || 'PAPER';

    if (!acceptsAddons(ServerType.fromExisting(serverType))) {
      log.error(`Server type '${serverType}' may not support mods`);
      console.log(`Supported types: ${ServerType.getAll().filter(acceptsAddons).map((t) => t.value).join(', ')}`);
      if (!options.force) {
        console.log('Use --force to add anyway');
        return 1;
      }
    }

    // Validate mods exist on the source (if adapter is available)
    const validMods: ModProject[] = [];
    const invalidMods: string[] = [];

    if (adapter) {
      console.log('');
      console.log(colors.dim(`Validating mods on ${adapter.displayName}...`));

      for (const modName of modNames) {
        const project = await adapter.getProject(modName);
        if (project) {
          validMods.push(project);
          console.log(`  ${colors.green('✓')} ${project.title} (${project.slug})`);
        } else {
          invalidMods.push(modName);
          console.log(`  ${colors.red('✗')} ${modName} - not found`);
        }
      }

      if (invalidMods.length > 0 && !options.force) {
        console.log('');
        log.error(`Some mods not found: ${invalidMods.join(', ')}`);
        console.log('Use --force to add anyway');
        return 1;
      }
    }

    // Update config.env
    const modsToAdd = adapter ? validMods.map(m => adapter.formatForEnv(m)) : modNames;
    const envKey = adapter ? adapter.getEnvKey() : getEnvKeyForSource(source, serverType);
    const currentMods = parseModList(config[envKey] || '');
    const newMods = [...new Set([...currentMods, ...modsToAdd])];

    // Write updated config (only this key; comments and other lines are kept)
    await writeServerConfig(paths, serverName, { set: { [envKey]: newMods.join(',') } });

    console.log('');
    console.log(colors.green(`✓ Added ${modsToAdd.length} mod(s) to ${serverName}`));
    console.log('');

    for (const mod of modsToAdd) {
      console.log(`  ${colors.cyan(mod)}`);
    }

    console.log('');
    console.log(colors.dim(`Config: ${envKey}=${newMods.join(',')}`));
    console.log('');
    console.log(colors.yellow('Restart the server to apply changes:'));
    console.log(`  mcctl stop ${serverName} && mcctl start ${serverName}`);
    console.log('');

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to add mods: ${message}`);
    return 1;
  }
}

/**
 * List installed mods
 */
async function modList(
  paths: Paths,
  options: ModCommandOptions
): Promise<number> {
  const { serverName } = options;

  if (!serverName) {
    log.error('Server name required');
    console.log('Usage: mcctl mod list <server>');
    return 1;
  }

  // Check server exists
  const serverDir = join(paths.servers, serverName);
  const configPath = join(serverDir, 'config.env');

  if (!existsSync(configPath)) {
    log.error(`Server '${serverName}' not found`);
    return 1;
  }

  try {
    const configContent = await readFile(configPath, 'utf-8');
    const config = Object.fromEntries(parseEnvDocument(configContent).values);
    const serverType = config['TYPE'] || 'PAPER';

    const sources = [
      { key: 'MODRINTH_PROJECTS', name: 'Modrinth', mods: parseModList(config['MODRINTH_PROJECTS'] || '') },
      { key: 'CURSEFORGE_FILES', name: 'CurseForge', mods: parseModList(config['CURSEFORGE_FILES'] || '') },
      { key: 'SPIGET_RESOURCES', name: 'Spiget', mods: parseModList(config['SPIGET_RESOURCES'] || '') },
      { key: 'MODS', name: 'URL', mods: parseModList(config['MODS'] || '') },
      { key: 'PLUGINS', name: 'Plugins URL', mods: parseModList(config['PLUGINS'] || '') },
    ];

    const allMods = sources.flatMap(s => s.mods.map(m => ({ source: s.name, mod: m })));

    if (options.json) {
      console.log(JSON.stringify({ serverType, sources, total: allMods.length }, null, 2));
      return 0;
    }

    console.log('');
    console.log(colors.bold(`Mods for ${serverName} (${serverType}):`));
    console.log('');

    if (allMods.length === 0) {
      console.log('  No mods configured');
      console.log('');
      console.log(colors.dim('Use: mcctl mod add <server> <mod> to install mods'));
      console.log('');
      return 0;
    }

    for (const source of sources) {
      if (source.mods.length > 0) {
        console.log(`  ${colors.cyan(source.name)}:`);
        for (const mod of source.mods) {
          console.log(`    - ${mod}`);
        }
        console.log('');
      }
    }

    console.log(colors.dim(`Total: ${allMods.length} mod(s)`));
    console.log('');

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to list mods: ${message}`);
    return 1;
  }
}

/**
 * Remove mod from server
 */
async function modRemove(
  paths: Paths,
  options: ModCommandOptions
): Promise<number> {
  const { serverName, modNames } = options;

  if (!serverName) {
    log.error('Server name required');
    console.log('Usage: mcctl mod remove <server> <mod...>');
    return 1;
  }

  if (!modNames || modNames.length === 0) {
    log.error('At least one mod name required');
    console.log('Usage: mcctl mod remove <server> <mod...>');
    return 1;
  }

  const serverDir = join(paths.servers, serverName);
  const configPath = join(serverDir, 'config.env');

  if (!existsSync(configPath)) {
    log.error(`Server '${serverName}' not found`);
    return 1;
  }

  try {
    const configContent = await readFile(configPath, 'utf-8');
    const config = Object.fromEntries(parseEnvDocument(configContent).values);

    let removed = 0;
    const changed: Record<string, string> = {};
    const envKeys = ['MODRINTH_PROJECTS', 'CURSEFORGE_FILES', 'SPIGET_RESOURCES', 'MODS', 'PLUGINS'];

    for (const modName of modNames) {
      for (const key of envKeys) {
        const mods = parseModList(config[key] || '');
        const index = mods.findIndex(m => m.toLowerCase() === modName.toLowerCase());

        if (index !== -1) {
          mods.splice(index, 1);
          config[key] = mods.join(',');
          changed[key] = config[key];
          removed++;
          console.log(`  ${colors.green('✓')} Removed ${modName} from ${key}`);
          break;
        }
      }
    }

    if (removed === 0) {
      log.warn('No mods were removed (not found in config)');
      return 0;
    }

    await writeServerConfig(paths, serverName, { set: changed });

    console.log('');
    console.log(colors.green(`✓ Removed ${removed} mod(s) from ${serverName}`));
    console.log('');
    console.log(colors.yellow('Restart the server to apply changes:'));
    console.log(`  mcctl stop ${serverName} && mcctl start ${serverName}`);
    console.log('');

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to remove mods: ${message}`);
    return 1;
  }
}

/**
 * Show available mod sources
 */
async function modSources(options: ModCommandOptions): Promise<number> {
  const sources = [
    {
      name: 'Modrinth',
      flag: '--modrinth (default)',
      envKey: 'MODRINTH_PROJECTS',
      description: 'Free, open-source mod platform. No API key required.',
      example: 'mcctl mod add myserver sodium lithium',
    },
    {
      name: 'CurseForge',
      flag: '--curseforge',
      envKey: 'CURSEFORGE_FILES',
      description: 'Popular mod platform. Java 17+ images include a built-in CF_API_KEY; set it in .env only for java8 or pre-17 tags or your own key',
      example: 'mcctl mod add myserver --curseforge jei journeymap',
    },
    {
      name: 'Spiget (SpigotMC)',
      flag: '--spiget',
      envKey: 'SPIGET_RESOURCES',
      description: 'SpigotMC plugin repository. Use resource IDs.',
      example: 'mcctl mod add myserver --spiget 9089',
    },
    {
      name: 'URL',
      flag: '--url',
      envKey: 'MODS / PLUGINS',
      description: 'Direct JAR file download URLs.',
      example: 'mcctl mod add myserver --url https://example.com/mod.jar',
    },
  ];

  if (options.json) {
    console.log(JSON.stringify(sources, null, 2));
    return 0;
  }

  console.log('');
  console.log(colors.bold('Available Mod Sources:'));
  console.log('');

  for (const source of sources) {
    console.log(`  ${colors.cyan(source.name)} ${colors.dim(source.flag)}`);
    console.log(`    ${source.description}`);
    console.log(`    Config: ${colors.yellow(source.envKey)}`);
    console.log(`    ${colors.dim(source.example)}`);
    console.log('');
  }

  return 0;
}

/**
 * Parse mod list from env value
 */
function parseModList(value: string): string[] {
  return value
    .split(/[,\s\n]+/)
    .map(m => m.trim())
    .filter(Boolean);
}

/**
 * Get environment variable key for source
 */
function getEnvKeyForSource(source: string, serverType: string): string {
  switch (source) {
    case 'curseforge':
      return 'CURSEFORGE_FILES';
    case 'spiget':
      return 'SPIGET_RESOURCES';
    case 'url':
      // Plugins for Paper/Spigot and their forks, Mods for Forge/Fabric
      return ServerType.fromExisting(serverType).supportsPlugins ? 'PLUGINS' : 'MODS';
    default:
      return 'MODRINTH_PROJECTS';
  }
}

/**
 * Format download count for display
 */
function formatDownloads(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return String(count);
}

/**
 * Whether mod add fits the server without --force: plugin servers and mod
 * loaders, not modpacks (the modpack brings its mods) (#826)
 */
function acceptsAddons(type: Pick<ServerTypeInfo, 'supportsPlugins' | 'supportsMods' | 'isModpack'>): boolean {
  return type.supportsPlugins || (type.supportsMods && !type.isModpack);
}
