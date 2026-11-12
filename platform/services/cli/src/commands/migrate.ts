import {
  Paths,
  log,
  colors,
  checkProposed,
  unrestoredFiles,
  type IContainerRuntimePort,
  type IWorldAssignmentPort,
  type IWorldRepository,
  type WorldAssignmentSnapshot,
} from '@minecraft-docker/shared';
import { getContainer } from '../infrastructure/index.js';
import { migrateSpec } from './migrate-spec.js';
import { isContainerRunning, serverOfContainer } from '../lib/rcon.js';
import * as fs from 'fs';
import * as path from 'path';
import { parseEnvDocument } from '@minecraft-docker/shared/utils';
import { serverSpecRepository, writeServerConfig } from '../lib/server-config.js';

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

    case 'spec':
      return migrateSpec(getContainer(options.root).serverSpecRepository, options);

    default:
      log.error(`Unknown migrate subcommand: ${subCommand}`);
      console.log('Usage: mcctl migrate [worlds|status|spec]');
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
  const servers = await scanServers(paths, getContainer(options.root));

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
      : server.reason
        ? colors.red(server.reason)
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
    const servers = await scanServers(paths, container);
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

    // Dry run mode: the plan each server would really get, without touching anything
    if (options.dryRun) {
      console.log('');
      console.log(colors.yellow('DRY RUN - No changes will be made'));
      console.log('');

      let refusedCount = 0;
      for (const server of serversToMigrate) {
        try {
          const plan = await planMigration(paths, server.name, container.worldAssignmentPort);
          const steps = [`Remove container mc-${server.name} (mcctl start ${server.name} creates it again)`];
          if (options.backup && plan.moves.length > 0) {
            steps.push(`Back up to ${path.join(paths.backups, 'migrate', `${server.name}-<time>`)}`);
          }
          if (plan.moves.length === 0) {
            steps.push(`No world in servers/${server.name}/data to move; the server will use ${path.join(paths.worlds, plan.level)}`);
          }
          for (const [from, to] of plan.moves) steps.push(`Move ${from} → ${to}`);
          steps.push(`Set LEVEL=${plan.level} and EXTRA_ARGS=${plan.extraArgs} in config.env`);
          console.log(colors.bold(`Would migrate: ${server.name}`));
          steps.forEach((step, n) => console.log(`  ${n + 1}. ${step}`));
        } catch (error) {
          refusedCount++;
          console.log(colors.red(`Would not migrate: ${server.name}: ${error instanceof Error ? error.message : String(error)}`));
        }
        console.log('');
      }

      return refusedCount > 0 ? 1 : 0;
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

      // migrateServer stops and removes each container before it moves anything
    }

    // Perform migration
    console.log('');
    let failCount = 0;
    const migrated: string[] = [];

    for (const server of serversToMigrate) {
      console.log(colors.bold(`Migrating: ${server.name}`));

      try {
        const plan = await planMigration(paths, server.name, container.worldAssignmentPort);
        await migrateServer(paths, server.name, plan, options.backup ?? false, container.containerRuntime);
        console.log(colors.green(`  ✓ Migration complete`));
        migrated.push(server.name);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(colors.red(`  ✗ Migration failed: ${message}`));
        failCount++;
      }

      console.log('');
    }

    // Summary
    console.log(colors.bold('Migration Summary:'));
    console.log(`  Success: ${colors.green(String(migrated.length))}`);
    if (failCount > 0) {
      console.log(`  Failed: ${colors.red(String(failCount))}`);
    }
    console.log('');

    if (migrated.length > 0) {
      // Removed so mc-router could not start them with their old settings; start creates them again
      console.log('Their containers were removed for the migration. Start the servers with:');
      for (const name of migrated) console.log(`  mcctl start ${name}`);
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
 * Scan servers and check migration status: a server needs migration while
 * its world (LEVEL) is read from data/, or while servers/<n>/data/<LEVEL>
 * still holds a world (#655).
 */
async function scanServers(
  paths: Paths,
  container: { worldAssignmentPort: IWorldAssignmentPort; worldRepository: IWorldRepository }
): Promise<ServerMigrationInfo[]> {
  const { assignments, undetermined } = await container.worldAssignmentPort.snapshot();
  const inData = new Map((await container.worldRepository.findServerInternalWorlds()).map((w) => [w.server, w]));
  const servers: ServerMigrationInfo[] = assignments.map((a) => {
    const left = inData.get(a.server);
    const where = `servers/${a.server}/data/${a.world}`;
    const reason = left
      ? a.internal ? `World in ${where}` : `An earlier migration left the world in ${where}`
      : a.internal ? 'Missing EXTRA_ARGS=--universe /worlds/' : undefined;
    return {
      name: a.server,
      needsMigration: !!reason,
      reason,
      currentWorldPath: left?.path,
      targetWorldPath: path.join(paths.worlds, finalLevel(a)),
      hasExtraArgs: !a.internal,
      levelValue: a.world,
    };
  });
  for (const name of undetermined) {
    servers.push({ name, needsMigration: false, reason: `Cannot tell where the world is: check servers/${name}/config.env` });
  }
  return servers.sort((a, b) => a.name.localeCompare(b.name));
}

/** LEVEL after migration: the default name `world` would clash in worlds/, so it takes the server name. */
function finalLevel(a: { server: string; world: string; internal?: boolean }): string {
  return a.internal && a.world === 'world' ? a.server : a.world;
}

interface MigrationPlan {
  level: string;
  extraArgs: string;
  config: string;
  /** [from, to]: data/<LEVEL> and the split dimension folders of Paper/Spigot */
  moves: Array<[string, string]>;
  before: WorldAssignmentSnapshot;
  intended: WorldAssignmentSnapshot;
}

const DIMENSION_SUFFIXES = ['', '_nether', '_the_end'];

/**
 * What migrating `name` would do. Throws, before anything is changed, when
 * the world cannot be found, a target in worlds/ exists, or the result breaks
 * the world assignments (#670). Vanilla keeps DIM-1/DIM1 inside the world
 * folder, so they move with it.
 */
async function planMigration(paths: Paths, name: string, assignments: IWorldAssignmentPort): Promise<MigrationPlan> {
  const before = await assignments.snapshot();
  const current = before.assignments.find((a) => a.server === name);
  if (!current) throw new Error(`Cannot tell which world ${name} uses: check servers/${name}/config.env`);
  const level = finalLevel(current);
  const rel = (p: string) => path.relative(paths.root, p);
  const kind = (p: string) => fs.lstatSync(p, { throwIfNoEntry: false });
  const data = path.join(paths.serverDir(name), 'data');
  const source = path.join(data, current.world);

  const moves: Array<[string, string]> = [];
  if (kind(source)?.isSymbolicLink()) {
    throw new Error(`${rel(source)} is a symbolic link; move the world it points to into worlds/ by hand`);
  }
  if (kind(source)?.isDirectory()) {
    for (const suffix of DIMENSION_SUFFIXES) {
      if (suffix === '' || kind(source + suffix)?.isDirectory()) {
        moves.push([source + suffix, path.join(paths.worlds, level + suffix)]);
      }
    }
    const taken = DIMENSION_SUFFIXES.map((suffix) => path.join(paths.worlds, level + suffix)).find((p) => kind(p));
    if (taken) {
      throw new Error(
        `${rel(taken)} already exists while the world of ${name} is still in ${rel(source)}; ` +
          `nothing was changed: keep one copy (move the other out of the way), then run again`
      );
    }
  } else {
    // No world under LEVEL: refuse if data/ holds one under another name rather than leave it behind
    const other = (fs.existsSync(data) ? fs.readdirSync(data, { withFileTypes: true }) : [])
      .filter((e) => e.isDirectory())
      .map((e) => path.join(data, e.name))
      .find((p) => fs.existsSync(path.join(p, 'level.dat')) || DIMENSION_SUFFIXES.slice(1).some((s) => p === source + s));
    if (other) {
      throw new Error(
        `${rel(source)} (LEVEL=${current.world}) does not exist, but ${rel(other)} holds a world; ` +
          `nothing was changed: set LEVEL in servers/${name}/config.env to the world the server uses, then run again`
      );
    }
  }

  const config = proposeConfig(fs.readFileSync(path.join(paths.serverDir(name), 'config.env'), 'utf-8'), level);
  const intended = await assignments.preview(name, config);
  const refused = checkProposed(intended, name);
  if (refused) throw refused;
  const after = intended.assignments.find((a) => a.server === name);
  if (after?.world !== level || after.internal) {
    throw new Error(
      `EXTRA_ARGS in servers/${name}/config.env would still keep the world in data/; ` +
        `nothing was changed: make it use --universe /worlds/, then run again`
    );
  }
  const extraArgs = parseEnvDocument(config).values.get('EXTRA_ARGS') ?? '--universe /worlds/';
  return { level, extraArgs, config, moves, before, intended };
}

/** Undo steps in reverse order; returns the messages of those that failed. */
function undoAll(undo: Array<() => void>): string[] {
  const failed: string[] = [];
  for (const step of undo.reverse()) {
    try {
      step();
    } catch (e) {
      failed.push((e as Error).message);
    }
  }
  return failed;
}

/**
 * Migrate a single server by its plan. The container is removed first: mc-router
 * auto-scale only starts existing containers, and an old one would start with the
 * old settings and make a new, empty world while the old one is moved.
 */
async function migrateServer(
  paths: Paths,
  name: string,
  plan: MigrationPlan,
  createBackup: boolean,
  runtime: IContainerRuntimePort
): Promise<void> {
  const where = `servers/${name}`;
  const removed = await runtime.remove(serverOfContainer(`mc-${name}`));
  if (!removed.success) {
    throw new Error(`${removed.error ?? `Failed to remove container mc-${name}`}; nothing was changed`);
  }

  if (createBackup && plan.moves.length > 0) {
    const backupDir = path.join(paths.backups, 'migrate', `${name}-${Date.now()}`);
    console.log(`  Creating backup: ${backupDir}`);
    try {
      for (const [from] of plan.moves) fs.cpSync(from, path.join(backupDir, path.basename(from)), { recursive: true });
    } catch (error) {
      throw new Error(`Backup failed: ${(error as Error).message}; the world was not moved (start the server with mcctl start ${name})`);
    }
  }

  // Every move is undone if a later move or the spec write below is refused (import refused, locked,
  // invalid spec): a moved world with the old LEVEL would make the server start a new one.
  const undo: Array<() => void> = [];
  fs.mkdirSync(paths.worlds, { recursive: true });
  try {
    for (const [from, to] of plan.moves) {
      if (fs.existsSync(to)) throw new Error(`${to} appeared during the migration`);
      console.log(`  Moving ${from} → ${to}`);
      fs.renameSync(from, to);
      undo.push(() => fs.renameSync(to, from));
    }
  } catch (error) {
    const failed = undoAll(undo);
    const note = failed.length > 0
      ? `moving the world back failed: ${failed.join('; ')}; move it back to ${where}/data by hand`
      : 'the world was moved back';
    if (error instanceof Error) error.message += ` (${note})`;
    throw error;
  }

  // Update the ServerSpec (#675): world.storage universe, LEVEL; config.env is rendered
  console.log(`  Updating config.env`);
  console.log(`  Setting LEVEL=${plan.level}`);
  const { level, before, intended } = plan;
  try {
    await writeServerConfig(
      paths,
      name,
      { set: { LEVEL: level, EXTRA_ARGS: plan.extraArgs } },
      { allowStorageChange: true }
    );
  } catch (error) {
    if (undo.length === 0) throw error;
    // The spec write puts its files back. When it could not (unrestoredFiles) it keeps the new
    // server.yaml with them, and mcctl migrate spec renders whatever spec is left: place the world
    // where that spec puts it, so the world and the files match once it is run.
    const left = unrestoredFiles(error).length > 0;
    const { spec, storageClash } = left
      ? await specNow(paths, name, before, intended)
      : { spec: 'earlier' as const, storageClash: false };
    // mcctl migrate spec refuses a storage change, so it cannot settle a server.yaml whose storage
    // the absorbed config.env contradicts: that server.yaml has to go and the migration run again.
    const rerender = storageClash
      ? `${where}/server.yaml was written by this run and disagrees with ${where}/config.env; ` +
        `remove it, then run mcctl migrate worlds again`
      : `fix the cause and run mcctl migrate spec ${name} before you start the server`;
    let note: string;
    if (spec === 'migrated') {
      note = `${where}/server.yaml keeps the new world settings, so the world stays in worlds/${level}; ${rerender}`;
    } else if (spec === 'unknown') {
      note = `could not tell which world the spec of ${name} now uses, so the world was left in worlds/${level}; ` +
        `check world in ${where}/server.yaml and LEVEL and EXTRA_ARGS in ${where}/config.env and move the world to match by hand`;
    } else {
      const failed = undoAll(undo);
      note = failed.length > 0
        ? `moving the world back failed: ${failed.join('; ')}; move it back to ${where}/data by hand`
        : `the world was moved back${left ? `; ${rerender}` : ''}`;
    }
    if (error instanceof Error) error.message += ` (${note})`;
    throw error;
  }
}

/**
 * Which world the spec mcctl migrate spec would render for `server` puts it
 * in (load(): server.yaml with hand edits absorbed): the migrated one, the
 * earlier one, or neither / unreadable ('unknown'). `storageClash`: that spec
 * and server.yaml as written keep the world in different places, which
 * mcctl migrate spec refuses (storage_change).
 */
async function specNow(
  paths: Paths,
  server: string,
  before: WorldAssignmentSnapshot,
  intended: WorldAssignmentSnapshot
): Promise<{ spec: 'migrated' | 'earlier' | 'unknown'; storageClash: boolean }> {
  const assigned = (s: WorldAssignmentSnapshot) => {
    if (s.undetermined.includes(server)) return undefined;
    const a = s.assignments.find((x) => x.server === server);
    return a ? `${a.world}\0${!!a.internal}` : undefined;
  };
  const repo = serverSpecRepository(paths);
  const doc = await repo.load(server).then((l) => l?.document, () => undefined);
  const file = await repo.loadFile(server).then((l) => l?.document, () => undefined);
  const storageClash = !!doc && !!file && doc.world.storage !== file.world.storage;
  if (!doc) return { spec: 'unknown', storageClash };
  const now = `${doc.world.level}\0${doc.world.storage === 'data'}`;
  if (now === assigned(intended)) return { spec: 'migrated', storageClash };
  return { spec: now === assigned(before) ? 'earlier' : 'unknown', storageClash };
}

/**
 * config.env after migration: EXTRA_ARGS puts the universe at /worlds/ and
 * LEVEL names the world there.
 */
function proposeConfig(content: string, newLevelValue: string): string {
  let configContent = content;

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

  // Update LEVEL
  if (configContent.match(/^LEVEL=.*$/m)) {
    configContent = configContent.replace(
      /^LEVEL=.*$/m,
      `LEVEL=${newLevelValue}`
    );
  } else {
    configContent += `\nLEVEL=${newLevelValue}\n`;
  }

  return configContent;
}
