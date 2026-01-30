import { Paths, log, colors } from '@minecraft-docker/shared';
import { getContainer } from '../infrastructure/index.js';
import { isContainerRunning } from '../lib/rcon.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Migrate command options
 */
export interface MigrateCommandOptions {
  root?: string;
  subCommand?: string;
  serverName?: string;
  all?: boolean;
  dryRun?: boolean;
  backup?: boolean;
  force?: boolean;
  json?: boolean;
}

interface ServerMigrationInfo {
  name: string;
  needsMigration: boolean;
  reason?: string;
  currentWorldPath?: string;
  targetWorldPath?: string;
  hasExtraArgs?: boolean;
  levelValue?: string;
}

/**
 * Execute migrate command
 */
export async function migrateCommand(options: MigrateCommandOptions): Promise<number> {
  const paths = new Paths(options.root);

  // Check if initialized
  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  const subCommand = options.subCommand ?? 'worlds';

  switch (subCommand) {
    case 'worlds':
      return migrateWorlds(paths, options);

    case 'status':
      return migrationStatus(paths, options);

    default:
      log.error(`Unknown migrate subcommand: ${subCommand}`);
      console.log('Usage: mcctl migrate [worlds|status]');
      return 1;
  }
}

/**
 * Check migration status for all servers
 */
async function migrationStatus(
  paths: Paths,
  options: MigrateCommandOptions
): Promise<number> {
  const servers = await scanServers(paths);

  if (servers.length === 0) {
    console.log('No servers found.');
    return 0;
  }

  const needsMigration = servers.filter(s => s.needsMigration);

  if (options.json) {
    console.log(JSON.stringify({ servers, needsMigration: needsMigration.length }, null, 2));
    return 0;
  }

  console.log('');
  console.log(colors.bold('Migration Status:'));
  console.log('');

  for (const server of servers) {
    const status = server.needsMigration
      ? colors.yellow('needs migration')
      : colors.green('up to date');

    console.log(`  ${colors.cyan(server.name)}: ${status}`);
    if (server.needsMigration && server.reason) {
      console.log(`    ${colors.dim(server.reason)}`);
    }
  }

  console.log('');
  if (needsMigration.length > 0) {
    console.log(colors.yellow(`${needsMigration.length} server(s) need migration.`));
    console.log(`Run: ${colors.bold('mcctl migrate worlds')} to migrate.`);
  } else {
    console.log(colors.green('All servers are up to date.'));
  }
  console.log('');

  return 0;
}

/**
 * Migrate worlds to shared worlds/ directory
 */
async function migrateWorlds(
  paths: Paths,
  options: MigrateCommandOptions
): Promise<number> {
  const container = getContainer(options.root);
  const prompt = container.promptPort;

  try {
    const servers = await scanServers(paths);
    const needsMigration = servers.filter(s => s.needsMigration);

    if (needsMigration.length === 0) {
      console.log('');
      console.log(colors.green('✓ All servers are already using the new world directory structure.'));
      console.log('');
      return 0;
    }

    // Show servers that need migration
    console.log('');
    console.log(colors.bold('Servers requiring migration:'));
    console.log('');

    for (const server of needsMigration) {
      console.log(`  ${colors.cyan(server.name)}`);
      console.log(`    ${colors.dim(server.reason || 'World stored in server directory')}`);
      if (server.currentWorldPath) {
        console.log(`    Current: ${colors.dim(server.currentWorldPath)}`);
      }
      if (server.targetWorldPath) {
        console.log(`    Target:  ${colors.dim(server.targetWorldPath)}`);
      }
      console.log('');
    }

    // Select servers to migrate
    let serversToMigrate: ServerMigrationInfo[];

    if (options.all) {
      serversToMigrate = needsMigration;
    } else if (options.serverName) {
      const server = needsMigration.find(s => s.name === options.serverName);
      if (!server) {
        log.error(`Server '${options.serverName}' not found or doesn't need migration`);
        return 1;
      }
      serversToMigrate = [server];
    } else {
      // Interactive selection - select one at a time
      const serverOptions = needsMigration.map(s => ({
        value: s.name,
        label: s.name,
        hint: s.reason,
      }));

      // Add "all" option
      serverOptions.unshift({
        value: '__all__',
        label: 'All servers',
        hint: `Migrate all ${needsMigration.length} servers`,
      });

      const selected = await prompt.select<string>({
        message: 'Select server to migrate:',
        options: serverOptions,
      });

      if (prompt.isCancel(selected)) {
        console.log('Migration cancelled.');
        return 0;
      }

      if (selected === '__all__') {
        serversToMigrate = needsMigration;
      } else {
        const server = needsMigration.find(s => s.name === selected);
        serversToMigrate = server ? [server] : [];
      }
    }

    if (serversToMigrate.length === 0) {
      console.log('No servers selected for migration.');
      return 0;
    }

    // Dry run mode
    if (options.dryRun) {
      console.log('');
      console.log(colors.yellow('DRY RUN - No changes will be made'));
      console.log('');

      for (const server of serversToMigrate) {
        console.log(colors.bold(`Would migrate: ${server.name}`));
        console.log(`  1. Stop server if running`);
        if (options.backup) {
          console.log(`  2. Backup world data`);
        }
        console.log(`  ${options.backup ? '3' : '2'}. Move world: ${server.currentWorldPath} → ${server.targetWorldPath}`);
        console.log(`  ${options.backup ? '4' : '3'}. Update config.env:`);
        console.log(`     - Add: EXTRA_ARGS=--universe /worlds/`);
        console.log(`     - Set: LEVEL=${server.name}`);
        console.log('');
      }

      return 0;
    }

    // Confirm migration
    if (!options.force) {
      const confirm = await prompt.confirm({
        message: `Migrate ${serversToMigrate.length} server(s)? This will move world data.`,
        initialValue: false,
      });

      if (prompt.isCancel(confirm) || !confirm) {
        console.log('Migration cancelled.');
        return 0;
      }
    }

    // Check if servers are running
    console.log('');
    console.log('Checking server status...');

    const runningServers: string[] = [];

    for (const server of serversToMigrate) {
      const containerName = `mc-${server.name}`;
      const running = await isContainerRunning(containerName);
      if (running) {
        runningServers.push(server.name);
      }
    }

    if (runningServers.length > 0) {
      console.log('');
      console.log(colors.yellow('The following servers are running:'));
      for (const name of runningServers) {
        console.log(`  - ${name}`);
      }
      console.log('');

      // Skip confirmation if --force is used
      if (!options.force) {
        const stopConfirm = await prompt.confirm({
          message: 'Stop these servers to proceed with migration?',
          initialValue: true,
        });

        if (prompt.isCancel(stopConfirm) || !stopConfirm) {
          console.log('Migration cancelled. Please stop servers manually first.');
          return 1;
        }
      } else {
        console.log(colors.dim('--force: Stopping servers automatically...'));
      }

      // Stop running servers
      for (const name of runningServers) {
        console.log(`Stopping ${name}...`);
        await stopContainer(`mc-${name}`);
      }
    }

    // Perform migration
    console.log('');
    let successCount = 0;
    let failCount = 0;

    for (const server of serversToMigrate) {
      console.log(colors.bold(`Migrating: ${server.name}`));

      try {
        await migrateServer(paths, server, options.backup ?? false);
        console.log(colors.green(`  ✓ Migration complete`));
        successCount++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(colors.red(`  ✗ Migration failed: ${message}`));
        failCount++;
      }

      console.log('');
    }

    // Summary
    console.log(colors.bold('Migration Summary:'));
    console.log(`  Success: ${colors.green(String(successCount))}`);
    if (failCount > 0) {
      console.log(`  Failed: ${colors.red(String(failCount))}`);
    }
    console.log('');

    if (runningServers.length > 0 && successCount > 0) {
      console.log(colors.dim('Servers were stopped for migration.'));
      console.log(colors.dim(`Start them with: mcctl start --all`));
      console.log('');
    }

    return failCount > 0 ? 1 : 0;
  } catch (error) {
    if (prompt.isCancel(error)) {
      console.log('Migration cancelled.');
      return 0;
    }

    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}

/**
 * Scan servers and check migration status
 */
async function scanServers(paths: Paths): Promise<ServerMigrationInfo[]> {
  const serversDir = paths.servers;
  const worldsDir = paths.worlds;

  if (!fs.existsSync(serversDir)) {
    return [];
  }

  const entries = fs.readdirSync(serversDir, { withFileTypes: true });
  const servers: ServerMigrationInfo[] = [];

  for (const entry of entries) {
    // Skip template and non-directories
    if (!entry.isDirectory() || entry.name === '_template') {
      continue;
    }

    const serverName = entry.name;
    const serverDir = path.join(serversDir, serverName);
    const configPath = path.join(serverDir, 'config.env');
    const dataDir = path.join(serverDir, 'data');
    const worldDir = path.join(dataDir, 'world');

    // Check if config.env exists
    if (!fs.existsSync(configPath)) {
      continue;
    }

    // Read config.env
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const hasExtraArgs = configContent.includes('EXTRA_ARGS=') &&
                         configContent.includes('--universe');

    // Get LEVEL value
    const levelMatch = configContent.match(/^LEVEL=(.*)$/m);
    const levelValue = levelMatch ? levelMatch[1]?.trim() : 'world';

    // Check if world exists in server's data directory
    const worldExistsInData = fs.existsSync(worldDir) &&
                              fs.statSync(worldDir).isDirectory() &&
                              !fs.lstatSync(worldDir).isSymbolicLink();

    // Determine if migration is needed
    let needsMigration = false;
    let reason: string | undefined;

    if (!hasExtraArgs) {
      needsMigration = true;
      reason = 'Missing EXTRA_ARGS=--universe /worlds/';
    } else if (worldExistsInData) {
      needsMigration = true;
      reason = 'World data still in server directory';
    }

    const targetWorldPath = path.join(worldsDir, serverName);

    servers.push({
      name: serverName,
      needsMigration,
      reason,
      currentWorldPath: worldExistsInData ? worldDir : undefined,
      targetWorldPath,
      hasExtraArgs,
      levelValue,
    });
  }

  return servers;
}

/**
 * Migrate a single server
 */
async function migrateServer(
  paths: Paths,
  server: ServerMigrationInfo,
  createBackup: boolean
): Promise<void> {
  const serversDir = paths.servers;
  const worldsDir = paths.worlds;

  const serverDir = path.join(serversDir, server.name);
  const configPath = path.join(serverDir, 'config.env');
  const sourceWorldDir = path.join(serverDir, 'data', 'world');
  const targetWorldDir = path.join(worldsDir, server.name);

  // Ensure worlds directory exists
  if (!fs.existsSync(worldsDir)) {
    fs.mkdirSync(worldsDir, { recursive: true });
  }

  // Step 1: Backup if requested
  if (createBackup && fs.existsSync(sourceWorldDir)) {
    const backupDir = path.join(serverDir, 'data', `world_backup_${Date.now()}`);
    console.log(`  Creating backup: ${path.basename(backupDir)}`);
    await copyDirectory(sourceWorldDir, backupDir);
  }

  // Step 2: Move world data if it exists in server directory
  if (fs.existsSync(sourceWorldDir) && fs.statSync(sourceWorldDir).isDirectory()) {
    // Check if it's a symlink
    if (fs.lstatSync(sourceWorldDir).isSymbolicLink()) {
      console.log(`  World is already a symlink, removing...`);
      fs.unlinkSync(sourceWorldDir);
    } else {
      // Check if target already exists
      if (fs.existsSync(targetWorldDir)) {
        throw new Error(`Target world directory already exists: ${targetWorldDir}`);
      }

      console.log(`  Moving world data to worlds/${server.name}`);
      fs.renameSync(sourceWorldDir, targetWorldDir);
    }
  }

  // Also move world_nether and world_the_end if they exist (Vanilla server)
  const dimensionWorlds = ['world_nether', 'world_the_end'];
  for (const dimWorld of dimensionWorlds) {
    const sourceDimDir = path.join(serverDir, 'data', dimWorld);
    const targetDimDir = path.join(worldsDir, `${server.name}_${dimWorld.replace('world_', '')}`);

    if (fs.existsSync(sourceDimDir) &&
        fs.statSync(sourceDimDir).isDirectory() &&
        !fs.lstatSync(sourceDimDir).isSymbolicLink()) {
      console.log(`  Moving ${dimWorld} to worlds/`);
      if (!fs.existsSync(targetDimDir)) {
        fs.renameSync(sourceDimDir, targetDimDir);
      }
    }
  }

  // Step 3: Update config.env
  console.log(`  Updating config.env`);
  let configContent = fs.readFileSync(configPath, 'utf-8');

  // Add or update EXTRA_ARGS
  if (!configContent.includes('EXTRA_ARGS=')) {
    // Add EXTRA_ARGS after LEVEL line or at end of World section
    const levelLineMatch = configContent.match(/^LEVEL=.*$/m);
    if (levelLineMatch) {
      configContent = configContent.replace(
        levelLineMatch[0],
        `${levelLineMatch[0]}\n\n# Store world in shared /worlds/ directory\nEXTRA_ARGS=--universe /worlds/`
      );
    } else {
      configContent += '\n# Store world in shared /worlds/ directory\nEXTRA_ARGS=--universe /worlds/\n';
    }
  } else if (!configContent.includes('--universe')) {
    // EXTRA_ARGS exists but doesn't have --universe
    configContent = configContent.replace(
      /^(EXTRA_ARGS=.*)$/m,
      '$1 --universe /worlds/'
    );
  }

  // Determine the correct LEVEL value
  const newLevelValue = findExistingWorldName(worldsDir, server.levelValue, server.name);
  console.log(`  Setting LEVEL=${newLevelValue}`);

  // Update LEVEL
  if (configContent.match(/^LEVEL=.*$/m)) {
    configContent = configContent.replace(
      /^LEVEL=.*$/m,
      `LEVEL=${newLevelValue}`
    );
  } else {
    configContent += `\nLEVEL=${newLevelValue}\n`;
  }

  fs.writeFileSync(configPath, configContent);
}

/**
 * Find existing world name in worlds directory
 * Checks: current LEVEL value, server name, case-insensitive matches
 */
function findExistingWorldName(
  worldsDir: string,
  currentLevel: string | undefined,
  serverName: string
): string {
  if (!fs.existsSync(worldsDir)) {
    return serverName;
  }

  const worldDirs = fs.readdirSync(worldsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => d.name);

  // 1. Check if current LEVEL value exists in worlds/
  if (currentLevel && currentLevel !== 'world') {
    const exactMatch = worldDirs.find(w => w === currentLevel);
    if (exactMatch) {
      return exactMatch;
    }
  }

  // 2. Check if server name exists (exact match)
  const serverMatch = worldDirs.find(w => w === serverName);
  if (serverMatch) {
    return serverMatch;
  }

  // 3. Check case-insensitive match for server name
  const caseInsensitiveMatch = worldDirs.find(
    w => w.toLowerCase() === serverName.toLowerCase()
  );
  if (caseInsensitiveMatch) {
    return caseInsensitiveMatch;
  }

  // 4. Check case-insensitive match for current LEVEL
  if (currentLevel && currentLevel !== 'world') {
    const levelCaseMatch = worldDirs.find(
      w => w.toLowerCase() === currentLevel.toLowerCase()
    );
    if (levelCaseMatch) {
      return levelCaseMatch;
    }
  }

  // 5. Default to server name
  return serverName;
}

/**
 * Stop a Docker container
 */
async function stopContainer(containerName: string): Promise<void> {
  const { spawn } = await import('node:child_process');

  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['stop', containerName], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to stop container ${containerName}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Copy directory recursively
 */
async function copyDirectory(source: string, target: string): Promise<void> {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}
