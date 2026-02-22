#!/usr/bin/env node

import { Paths, log, colors, AuditActionEnum } from '@minecraft-docker/shared';
import {
  initCommand,
  statusCommand,
  createCommand,
  deleteCommand,
  worldCommand,
  backupCommand,
  execCommand,
  rconCommand,
  configCommand,
  opCommand,
  serverBackupCommand,
  serverRestoreCommand,
  whitelistCommand,
  banCommand,
  kickCommand,
  playerOnlineCommand,
  playerCommand,
  migrateCommand,
  modCommand,
  updateCommand,
  consoleInitCommand,
  consoleServiceCommand,
  consoleUserCommand,
  consoleApiCommand,
  consoleRemoveCommand,
  auditCommand,
  playitCommand,
  upgradeCommand,
  backupScheduleCommand,
  configSnapshotListCommand,
  configSnapshotCreateCommand,
  configSnapshotShowCommand,
  configSnapshotDeleteCommand,
  configSnapshotDiffCommand,
  configSnapshotRestoreCommand,
  configSnapshotScheduleListCommand,
  configSnapshotScheduleAddCommand,
  configSnapshotScheduleRemoveCommand,
  configSnapshotScheduleToggleCommand,
} from './commands/index.js';
import { ShellExecutor } from './lib/shell.js';
import { checkForUpdates } from './lib/update-checker.js';
import { readFileSync } from 'fs';
import { getContainer } from './infrastructure/di/container.js';

// Read version from package.json
function getVersion(): string {
  try {
    const packageJsonPath = new URL('../package.json', import.meta.url);
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version;
  } catch {
    return '0.0.0';
  }
}

const VERSION = getVersion();

/**
 * Handle console command (shared by both 'console' and deprecated 'admin' commands)
 */
async function handleConsoleCommand(
  subCommand: string | undefined,
  positional: string[],
  flags: Record<string, string | boolean>,
  rootDir: string | undefined
): Promise<number> {
  switch (subCommand) {
    case 'init':
      return consoleInitCommand({
        root: rootDir,
        force: flags['force'] === true,
        apiPort: flags['api-port'] ? parseInt(flags['api-port'] as string, 10) : undefined,
        consolePort: flags['console-port'] ? parseInt(flags['console-port'] as string, 10) : undefined,
      });
    case 'service':
      return consoleServiceCommand({
        root: rootDir,
        subCommand: positional[0] as 'start' | 'stop' | 'restart' | 'status' | 'logs' | undefined,
        apiOnly: flags['api'] === true,
        consoleOnly: flags['console'] === true,
        follow: flags['follow'] === true,
        json: flags['json'] === true,
        apiPort: flags['api-port'] ? parseInt(flags['api-port'] as string, 10) : undefined,
        consolePort: flags['console-port'] ? parseInt(flags['console-port'] as string, 10) : undefined,
        build: flags['build'] === true,
        noBuild: flags['no-build'] === true,
        force: flags['force'] === true,
      });
    case 'user': {
      // Use Commander-based command
      const userCmd = consoleUserCommand();
      userCmd.parse(['node', 'mcctl', ...positional], { from: 'user' });
      return 0;
    }
    case 'api': {
      // Use Commander-based command
      const apiCmd = consoleApiCommand();
      apiCmd.parse(['node', 'mcctl', ...positional], { from: 'user' });
      return 0;
    }
    case 'remove':
      return consoleRemoveCommand({
        root: rootDir,
        force: flags['force'] === true,
        keepConfig: flags['keep-config'] === true,
      });
    default:
      log.error('Usage: mcctl console <init|service|user|api|remove>');
      return 1;
  }
}

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
${colors.bold('mcctl')} - Minecraft Server Management CLI

${colors.cyan('Usage:')}
  mcctl <command> [options]

${colors.cyan('Commands:')}
  ${colors.bold('init')} [options]              Initialize platform (~/.minecraft-servers)
    --reconfigure             Reconfigure existing platform
    --playit-key <key>        Enable playit.gg with SECRET_KEY
    --no-playit               Explicitly disable playit.gg
  ${colors.bold('up')}                         Start all infrastructure (router + servers)
  ${colors.bold('down')}                       Stop all infrastructure
  ${colors.bold('router')} <start|stop|restart>  Manage mc-router only
  ${colors.bold('create')} <name> [options]    Create a new server
  ${colors.bold('delete')} <name> [--force]    Delete a server (preserves world data)
  ${colors.bold('status')} [options]            Show status of all servers
  ${colors.bold('status')} <server>             Show detailed status of a server
  ${colors.bold('status')} router               Show mc-router status with routes
  ${colors.bold('start')} <server> [--all]     Start a server (--all for all servers)
  ${colors.bold('stop')} <server> [--all]      Stop a server (--all for all servers)
  ${colors.bold('logs')} <server> [lines]      View server logs
  ${colors.bold('rcon')} <server>              Interactive RCON console
  ${colors.bold('exec')} <server> <cmd...>     Execute single RCON command
  ${colors.bold('config')} <server> [key] [val]  View/set server config

${colors.cyan('Config Shortcuts:')}
  --cheats, --no-cheats      Enable/disable cheats (ALLOW_CHEATS)
  --pvp, --no-pvp            Enable/disable PvP
  --command-block            Enable/disable command blocks

${colors.cyan('Player Management:')}
  ${colors.bold('op')} <server> <action> [player]      Manage operators
  ${colors.bold('whitelist')} <server> <action> [player]  Manage whitelist
  ${colors.bold('ban')} <server> <action> [player/ip]  Manage bans
  ${colors.bold('kick')} <server> <player> [reason]    Kick player

${colors.cyan('Operator Actions:')}
  list                      List current operators with levels
  add <player> [--level N]  Add operator (level 1-4, default: 4)
  remove <player>           Remove operator
  set-level <player> <1-4>  Change operator level (server must be running)

${colors.cyan('Whitelist Actions:')}
  list                    Show whitelisted players
  add <player>            Add to whitelist
  remove <player>         Remove from whitelist
  on / off                Enable/disable whitelist
  status                  Show whitelist status

${colors.cyan('Ban Actions:')}
  list                    Show banned players
  add <player> [reason]   Ban player
  remove <player>         Unban player
  ip list                 Show banned IPs
  ip add <ip> [reason]    Ban IP
  ip remove <ip>          Unban IP

${colors.cyan('World Management:')}
  ${colors.bold('world list')} [--json]        List worlds and lock status
  ${colors.bold('world new')} [name] [options] Create new world with seed
  ${colors.bold('world assign')} <world> <srv> Lock world to server
  ${colors.bold('world release')} <world>      Release world lock
  ${colors.bold('world delete')} <world> [-f]  Delete world permanently

${colors.cyan('Mod Management:')}
  ${colors.bold('mod search')} <query>         Search mods on Modrinth
  ${colors.bold('mod add')} <srv> <mod...>     Add mods to server
  ${colors.bold('mod list')} <server>          List configured mods
  ${colors.bold('mod remove')} <srv> <mod...>  Remove mods from server
  ${colors.bold('mod sources')}                Show available mod sources

${colors.cyan('Mod Add Options:')}
  --modrinth                 Use Modrinth (default)
  --curseforge               Use CurseForge (requires CF_API_KEY)
  --spiget                   Use Spiget (SpigotMC plugins)
  --url                      Direct JAR URL download

${colors.cyan('Mod Management:')}
  ${colors.bold('mod search')} <query>         Search mods on Modrinth
  ${colors.bold('mod add')} <srv> <mod...>     Add mods to server
  ${colors.bold('mod list')} <server>          List configured mods
  ${colors.bold('mod remove')} <srv> <mod...>  Remove mods from server
  ${colors.bold('mod sources')}                Show available mod sources

${colors.cyan('Mod Add Options:')}
  --modrinth                 Use Modrinth (default)
  --curseforge               Use CurseForge (requires CF_API_KEY)
  --spiget                   Use Spiget (SpigotMC plugins)
  --url                      Direct JAR URL download

${colors.cyan('World New Options:')}
  --seed <seed>              World seed (optional, random if empty)
  --server <name>            Server to assign world to
  --no-start                 Don't start server after creation

${colors.cyan('Player Management (Interactive):')}
  ${colors.bold('player')}                     Interactive mode: server → player → action
  ${colors.bold('player')} <server>            Interactive mode for specific server
  ${colors.bold('player info')} <name>         Player info lookup (UUID, skin)
  ${colors.bold('player info')} <name> --offline  Get offline player info
  ${colors.bold('player online')} <server>     List online players
  ${colors.bold('player online')} --all        List online players on all servers
  ${colors.bold('player cache')} clear         Clear player info cache
  ${colors.bold('player cache')} stats         Show cache statistics

${colors.cyan('Player Lookup (Legacy):')}
  ${colors.bold('player lookup')} <name>       Look up player info
  ${colors.bold('player uuid')} <name>         Get player UUID

${colors.cyan('Server Backup/Restore:')}
  ${colors.bold('server-backup')} <server> [-m msg]  Backup server configuration
  ${colors.bold('server-backup')} <server> --list   List all backups
  ${colors.bold('server-restore')} <server> [id]    Restore from backup

${colors.cyan('World Backup:')}
  ${colors.bold('backup init')} [--force]      Setup GitHub backup (interactive)
  ${colors.bold('backup push')} [--message]    Backup worlds to GitHub
  ${colors.bold('backup status')}              Show backup configuration
  ${colors.bold('backup history')} [--json]    Show backup history
  ${colors.bold('backup restore')} <commit>    Restore from commit

${colors.cyan('Backup Scheduling:')}
  ${colors.bold('backup schedule list')}        List all backup schedules
  ${colors.bold('backup schedule add')} [opts]  Create a new schedule
    --cron <expr|preset>        Cron expression or preset (daily, every-6h, etc.)
    --name <name>               Schedule name
    --max-count <n>             Maximum backups to retain
    --max-age-days <n>          Maximum backup age in days
  ${colors.bold('backup schedule remove')} <id> Remove a schedule
  ${colors.bold('backup schedule enable')} <id> Enable a schedule
  ${colors.bold('backup schedule disable')} <id> Disable a schedule

${colors.cyan('Config Snapshot Management:')}
  ${colors.bold('config-snapshot list')} [server]         List snapshots (all or per-server)
    --limit <n>                              Max results (default 20)
    --json                                   JSON output
  ${colors.bold('config-snapshot create')} <server>       Create a snapshot
    --description "..."                      Optional description
    --json                                   JSON output
  ${colors.bold('config-snapshot show')} <id>             Show snapshot details
    --files                                  Include file list
    --json                                   JSON output
  ${colors.bold('config-snapshot diff')} <id1> <id2>      Diff two snapshots
    --files-only                             Show only changed file names
    --json                                   JSON output
  ${colors.bold('config-snapshot restore')} <id>          Restore from snapshot
    --force                                  Skip confirmation
  ${colors.bold('config-snapshot delete')} <id>           Delete a snapshot
    --force                                  Skip confirmation

${colors.cyan('Config Snapshot Schedules:')}
  ${colors.bold('config-snapshot schedule list')}         List schedules
    --server <name>                          Filter by server
    --json                                   JSON output
  ${colors.bold('config-snapshot schedule add')} [opts]   Add a schedule
    --server <name>                          Server name (required)
    --cron "..."                             Cron expression (required)
    --name "..."                             Schedule name (required)
    --retention <n>                          Max snapshots to keep (default 10)
  ${colors.bold('config-snapshot schedule remove')} <id>  Remove a schedule
    --force                                  Skip confirmation
  ${colors.bold('config-snapshot schedule enable')} <id>  Enable a schedule
  ${colors.bold('config-snapshot schedule disable')} <id> Disable a schedule

${colors.cyan('Migration:')}
  ${colors.bold('migrate worlds')}             Migrate worlds to shared directory
  ${colors.bold('migrate status')}             Check migration status
  ${colors.bold('migrate worlds')} --all       Migrate all servers
  ${colors.bold('migrate worlds')} --dry-run   Preview changes without applying

${colors.cyan('Self Update:')}
  ${colors.bold('update')}                     Check and update mcctl to latest version
  ${colors.bold('update')} --check             Check for updates only (no install)
  ${colors.bold('update')} --force             Force check (ignore cache)
  ${colors.bold('update')} --yes               Auto-confirm update
  ${colors.bold('update')} --all               Update CLI and all installed services

${colors.cyan('Platform Upgrade:')}
  ${colors.bold('upgrade')}                    Sync .env and templates with latest CLI version
  ${colors.bold('upgrade')} --dry-run          Preview changes without applying
  ${colors.bold('upgrade')} --non-interactive  Apply defaults without prompting

${colors.cyan('playit.gg Management:')}
  ${colors.bold('playit start')}                Start playit-agent container
  ${colors.bold('playit stop')}                 Stop playit-agent container
  ${colors.bold('playit status')} [--json]      Show agent status and tunnel info
  ${colors.bold('playit setup')}                Configure PLAYIT_SECRET_KEY

${colors.cyan('Console Management:')}
  ${colors.bold('console init')} [options]       Initialize console service (create admin user)
    --force                      Reinitialize (delete existing config)
    --api-port <port>            API server port (default: 5001)
    --console-port <port>        Console server port (default: 5000)
  ${colors.bold('console user')} <action> [name] Manage console users (list, add, remove, reset)
  ${colors.bold('console api')} <action>         Manage API settings (status, config, key)
  ${colors.bold('console service')} <action>     Manage services via PM2 (start, stop, restart, status, logs)
    --force                      Kill PM2 daemon and restart fresh (stop, restart)
  ${colors.bold('console remove')} [options]     Remove console service completely
    --force                      Skip confirmation prompt
    --keep-config                Don't delete configuration files
  ${colors.dim('admin <cmd>                  (deprecated, use "console" instead)')}

${colors.cyan('Console Options:')}
  --api-port <port>            API server port (default: 5001)
  --console-port <port>        Console server port (default: 5000)
  --api                        Target API service only
  --console                    Target console service only
  -f, --follow                 Follow log output

${colors.cyan('Create Options:')}
  -t, --type TYPE            Server type: PAPER, VANILLA, FORGE, FABRIC, MODRINTH
  -v, --version VERSION      Minecraft version (e.g., 1.21.1)
  -s, --seed NUMBER          World seed
  -u, --world-url URL        Download world from ZIP URL
  -w, --world NAME           Use existing world (symlink)
  --no-start                 Create without starting
  --no-whitelist             Disable whitelist (enabled by default)
  --whitelist PLAYERS        Initial whitelist players (comma-separated)
  --modpack SLUG             Modrinth modpack slug (required for MODRINTH type)
  --modpack-version VERSION  Modpack version (optional, default: latest)
  --mod-loader LOADER        Mod loader (auto/fabric/forge/quilt, default: auto)
  --playit-domain DOMAIN     Register playit.gg external domain (e.g., aa.example.com)
  --no-playit-domain         Skip playit domain registration (explicit)

${colors.cyan('Status Options:')}
  --detail, -d               Show detailed info (memory, CPU, players)
  --watch, -W                Real-time monitoring mode
  --interval <sec>           Watch refresh interval (default: 5)

${colors.cyan('Global Options:')}
  --root <path>              Custom data directory
  --sudo-password <pwd>      Sudo password for automation (or use MCCTL_SUDO_PASSWORD env)
  --json                     Output in JSON format
  -h, --help                 Show this help
  --version                  Show version

${colors.cyan('Examples:')}
  mcctl init
  mcctl up                           # Start everything
  mcctl down                         # Stop everything
  mcctl router start                 # Start mc-router only
  mcctl router restart               # Restart mc-router
  mcctl start --all                  # Start all MC servers
  mcctl stop --all                   # Stop all MC servers
  mcctl create myserver -t FORGE -v 1.20.4
  mcctl create cobblemon -t MODRINTH --modpack cobblemon
  mcctl status --json
  mcctl status --detail              # Show detailed info
  mcctl status --watch               # Real-time monitoring
  mcctl status --watch --interval 2  # Watch with 2s refresh
  mcctl status myserver              # Single server status
  mcctl status router                # mc-router status
  mcctl logs myserver -f
  mcctl rcon myserver                # Interactive RCON console
  mcctl exec myserver say "Hello!"   # Single RCON command
  mcctl exec myserver list           # List online players
  mcctl config myserver              # View all config
  mcctl config myserver --cheats     # Enable cheats
  mcctl config myserver MOTD "Welcome!"  # Set MOTD
  mcctl op myserver list             # List operators
  mcctl op myserver add Notch        # Add operator
  mcctl whitelist myserver add Steve # Add to whitelist
  mcctl ban myserver add Griefer     # Ban player
  mcctl kick myserver AFK "Too long" # Kick player
  mcctl player online myserver       # Show online players
  mcctl server-backup myserver       # Backup server config
  mcctl server-restore myserver      # Restore from backup
`);
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): {
  command: string;
  subCommand?: string;
  positional: string[];
  flags: Record<string, string | boolean>;
} {
  const result = {
    command: '',
    subCommand: undefined as string | undefined,
    positional: [] as string[],
    flags: {} as Record<string, string | boolean>,
  };

  let i = 0;

  // Skip node and script path
  while (i < args.length) {
    const arg = args[i]!;

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      // Boolean-only flags (never take a value)
      const booleanOnlyFlags = ['all', 'json', 'help', 'version', 'force', 'yes', 'follow', 'detail', 'watch', 'offline', 'no-start', 'no-whitelist', 'list', 'dry-run', 'api', 'console', 'build', 'no-build', 'keep-config', 'check', 'reconfigure', 'no-playit', 'no-playit-domain', 'remove', 'non-interactive', 'upgrade'];

      if (booleanOnlyFlags.includes(key)) {
        result.flags[key] = true;
        i++;
      } else if (nextArg && !nextArg.startsWith('-')) {
        result.flags[key] = nextArg;
        i += 2;
      } else {
        result.flags[key] = true;
        i++;
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1);
      const nextArg = args[i + 1];

      // Map short flags to long names
      const flagMap: Record<string, string> = {
        h: 'help',
        t: 'type',
        v: 'version',
        s: 'seed',
        u: 'world-url',
        w: 'world',
        f: 'follow',
        n: 'lines',
        m: 'message',
        y: 'yes',
        a: 'all',
        d: 'detail',
        W: 'watch',
      };

      const longKey = flagMap[key] ?? key;

      // Boolean-only short flags
      const booleanOnlyShortFlags = ['h', 'f', 'y', 'a', 'd', 'W'];

      if (booleanOnlyShortFlags.includes(key)) {
        result.flags[longKey] = true;
        i++;
      } else if (nextArg && !nextArg.startsWith('-')) {
        result.flags[longKey] = nextArg;
        i += 2;
      } else {
        result.flags[longKey] = true;
        i++;
      }
    } else {
      if (!result.command) {
        result.command = arg;
      } else if (!result.subCommand && ['world', 'player', 'backup', 'op', 'whitelist', 'ban', 'router', 'migrate', 'mod', 'console', 'admin', 'playit', 'config-snapshot'].includes(result.command)) {
        result.subCommand = arg;
      } else {
        result.positional.push(arg);
      }
      i++;
    }
  }

  return result;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const parsed = parseArgs(args);
  const { command, subCommand, positional, flags } = parsed;

  // Handle global flags
  if (flags['help'] || command === 'help') {
    printUsage();
    process.exit(0);
  }

  if (flags['version'] === true || command === '--version') {
    console.log(`mcctl version ${VERSION}`);
    process.exit(0);
  }

  // Check for updates (with 24-hour cache)
  await checkForUpdates();

  const rootDir = flags['root'] as string | undefined;
  const sudoPassword = flags['sudo-password'] as string | undefined;
  const paths = new Paths(rootDir);
  const shell = new ShellExecutor({ paths, sudoPassword });

  let exitCode = 0;

  try {
    switch (command) {
      case 'init':
        exitCode = await initCommand({
          root: rootDir,
          skipValidation: flags['skip-validation'] === true,
          skipDocker: flags['skip-docker'] === true,
          reconfigure: flags['reconfigure'] === true,
          upgrade: flags['upgrade'] === true,
          playitKey: flags['playit-key'] as string | undefined,
          noPlayit: flags['no-playit'] === true,
        });
        break;

      case 'status':
        exitCode = await statusCommand({
          json: flags['json'] === true,
          root: rootDir,
          detail: flags['detail'] === true,
          watch: flags['watch'] === true,
          interval: flags['interval'] ? parseInt(flags['interval'] as string, 10) : undefined,
          serverName: positional[0],
        });
        break;

      case 'up': {
        if (!paths.isInitialized()) {
          log.error('Platform not initialized. Run: mcctl init');
          exitCode = 1;
          break;
        }
        exitCode = await shell.up();
        break;
      }

      case 'down': {
        if (!paths.isInitialized()) {
          log.error('Platform not initialized. Run: mcctl init');
          exitCode = 1;
          break;
        }
        exitCode = await shell.down();
        break;
      }

      case 'create': {
        // Use new interactive create command
        // If no name provided, will run in interactive mode
        exitCode = await createCommand({
          root: rootDir,
          name: positional[0],
          type: flags['type'] as string | undefined,
          version: flags['version'] as string | undefined,
          seed: flags['seed'] as string | undefined,
          worldUrl: flags['world-url'] as string | undefined,
          worldName: flags['world'] as string | undefined,
          noStart: flags['no-start'] === true,
          noWhitelist: flags['no-whitelist'] === true,
          whitelist: flags['whitelist'] as string | undefined,
          sudoPassword,
          modpack: flags['modpack'] as string | undefined,
          modpackVersion: flags['modpack-version'] as string | undefined,
          modLoader: flags['mod-loader'] as string | undefined,
          playitDomain: flags['playit-domain'] as string | undefined,
          noPlayitDomain: flags['no-playit-domain'] === true,
        });
        break;
      }

      case 'delete': {
        // Use new interactive delete command
        // If no name provided, will run in interactive mode with server selection
        exitCode = await deleteCommand({
          root: rootDir,
          name: positional[0],
          force: flags['force'] === true || flags['yes'] === true,
          sudoPassword,
        });
        break;
      }

      case 'start': {
        if (!paths.isInitialized()) {
          log.error('Platform not initialized. Run: mcctl init');
          exitCode = 1;
          break;
        }

        if (flags['all']) {
          exitCode = await shell.startAll();
        } else {
          const mcctlArgs = [command, ...positional];
          if (flags['json']) mcctlArgs.push('--json');
          exitCode = await shell.mcctl(mcctlArgs);
        }

        // Log audit
        const container = getContainer({ rootDir, sudoPassword });
        await container.auditLogPort.log({
          action: AuditActionEnum.SERVER_START,
          actor: 'cli:local',
          targetType: 'server',
          targetName: positional[0] || 'all',
          status: exitCode === 0 ? 'success' : 'failure',
          details: null,
          errorMessage: null,
        });
        break;
      }

      case 'stop': {
        if (!paths.isInitialized()) {
          log.error('Platform not initialized. Run: mcctl init');
          exitCode = 1;
          break;
        }

        if (flags['all']) {
          exitCode = await shell.stopAll();
        } else {
          const mcctlArgs = [command, ...positional];
          if (flags['json']) mcctlArgs.push('--json');
          exitCode = await shell.mcctl(mcctlArgs);
        }

        // Log audit
        const container = getContainer({ rootDir, sudoPassword });
        await container.auditLogPort.log({
          action: AuditActionEnum.SERVER_STOP,
          actor: 'cli:local',
          targetType: 'server',
          targetName: positional[0] || 'all',
          status: exitCode === 0 ? 'success' : 'failure',
          details: null,
          errorMessage: null,
        });
        break;
      }

      case 'console': {
        // Check if this is console management command (init, service, user, api, remove)
        const consoleManagementSubCommands = ['init', 'service', 'user', 'api', 'remove'];
        if (subCommand && consoleManagementSubCommands.includes(subCommand)) {
          // Route to console management
          exitCode = await handleConsoleCommand(subCommand, positional, flags, rootDir);
          break;
        }

        // Otherwise, treat as RCON console (mcctl console <server>)
        if (!paths.isInitialized()) {
          log.error('Platform not initialized. Run: mcctl init');
          exitCode = 1;
          break;
        }

        // Pass through to mcctl.sh for RCON console
        const mcctlArgs = [command, ...positional];
        if (flags['json']) mcctlArgs.push('--json');
        if (flags['follow']) mcctlArgs.push('-f');
        if (flags['lines']) mcctlArgs.push('-n', flags['lines'] as string);

        exitCode = await shell.mcctl(mcctlArgs);
        break;
      }

      case 'logs': {
        if (!paths.isInitialized()) {
          log.error('Platform not initialized. Run: mcctl init');
          exitCode = 1;
          break;
        }

        // Pass through to mcctl.sh
        const mcctlArgs = [command, ...positional];
        if (flags['json']) mcctlArgs.push('--json');
        if (flags['follow']) mcctlArgs.push('-f');
        if (flags['lines']) mcctlArgs.push('-n', flags['lines'] as string);

        exitCode = await shell.mcctl(mcctlArgs);
        break;
      }

      case 'exec': {
        exitCode = await execCommand({
          root: rootDir,
          serverName: positional[0],
          command: positional.slice(1),
        });
        break;
      }

      case 'rcon': {
        exitCode = await rconCommand({
          root: rootDir,
          serverName: positional[0],
        });
        break;
      }

      case 'config': {
        exitCode = await configCommand({
          root: rootDir,
          serverName: positional[0],
          key: positional[1],
          value: positional[2],
          json: flags['json'] === true,
          cheats: flags['cheats'] === true,
          noCheats: flags['no-cheats'] === true,
          pvp: flags['pvp'] === true,
          noPvp: flags['no-pvp'] === true,
          commandBlock: flags['command-block'] === true,
          noCommandBlock: flags['no-command-block'] === true,
        });
        break;
      }

      case 'world': {
        // Use new interactive world command
        exitCode = await worldCommand({
          root: rootDir,
          subCommand: subCommand,
          worldName: positional[0],
          serverName: subCommand === 'new'
            ? (flags['server'] as string | undefined)
            : positional[1],
          seed: flags['seed'] as string | undefined,
          autoStart: flags['no-start'] === true ? false : undefined,
          json: flags['json'] === true,
          force: flags['force'] === true,
        });
        break;
      }

      case 'player': {
        // Handle player subcommands
        if (subCommand === 'online') {
          // player online <server> - List online players
          exitCode = await playerOnlineCommand({
            root: rootDir,
            serverName: positional[0],
            all: flags['all'] === true,
            json: flags['json'] === true,
          });
        } else if (subCommand === 'info') {
          // player info <name> - Player info lookup
          exitCode = await playerCommand({
            root: rootDir,
            subCommand: 'info',
            playerName: positional[0],
            offline: flags['offline'] === true,
            json: flags['json'] === true,
          });
        } else if (subCommand === 'cache') {
          // player cache <clear|stats> - Cache management
          exitCode = await playerCommand({
            root: rootDir,
            subCommand: 'cache',
            cacheAction: positional[0] as 'clear' | 'stats',
            json: flags['json'] === true,
          });
        } else if (subCommand === 'lookup' || subCommand === 'uuid') {
          // Legacy lookup commands via shell.player
          const playerArgs = [subCommand, ...positional];
          if (flags['json']) playerArgs.push('--json');
          if (flags['offline']) playerArgs.push('--offline');
          exitCode = await shell.player(playerArgs);
        } else if (!subCommand || subCommand) {
          // Interactive mode: player [server]
          // If subCommand is provided but not a known command, treat it as server name
          exitCode = await playerCommand({
            root: rootDir,
            serverName: subCommand || positional[0],
            json: flags['json'] === true,
          });
        }
        break;
      }

      case 'backup': {
        // Handle 'backup schedule' as a special sub-sub-command
        if (subCommand === 'schedule') {
          exitCode = await backupScheduleCommand({
            root: rootDir,
            subCommand: positional[0],
            scheduleId: positional[1],
            cron: flags['cron'] as string | undefined,
            name: flags['name'] as string | undefined,
            maxCount: flags['max-count'] ? parseInt(flags['max-count'] as string, 10) : undefined,
            maxAgeDays: flags['max-age-days'] ? parseInt(flags['max-age-days'] as string, 10) : undefined,
            json: flags['json'] === true,
          });
          break;
        }

        // Use new interactive backup command
        exitCode = await backupCommand({
          root: rootDir,
          subCommand: subCommand,
          message: flags['message'] as string | undefined,
          commitHash: positional[0],
          json: flags['json'] === true,
          auto: flags['auto'] === true,
          force: flags['force'] === true,
        });
        break;
      }

      case 'op': {
        // op command: op <server> <action> [player] [level]
        // parseArgs treats second arg as subCommand, so:
        // subCommand = server name, positional[0] = action, positional[1] = player, positional[2] = level
        const level = positional[2] !== undefined ? parseInt(positional[2], 10) : flags['level'] as number | undefined;
        exitCode = await opCommand({
          root: rootDir,
          serverName: subCommand,
          subCommand: positional[0] as 'add' | 'remove' | 'list' | 'set-level' | undefined,
          playerName: positional[1],
          level,
          json: flags['json'] === true,
        });
        break;
      }

      case 'server-backup': {
        exitCode = await serverBackupCommand({
          root: rootDir,
          serverName: positional[0],
          message: flags['message'] as string | undefined,
          list: flags['list'] === true,
          json: flags['json'] === true,
        });
        break;
      }

      case 'server-restore': {
        exitCode = await serverRestoreCommand({
          root: rootDir,
          serverName: positional[0],
          backupId: positional[1],
          force: flags['force'] === true,
          dryRun: flags['dry-run'] === true,
          json: flags['json'] === true,
        });
        break;
      }

      case 'whitelist': {
        // whitelist command: whitelist <server> <action> [player]
        // subCommand = server name, positional[0] = action, positional[1] = player
        exitCode = await whitelistCommand({
          root: rootDir,
          serverName: subCommand,
          subCommand: positional[0] as 'list' | 'add' | 'remove' | 'on' | 'off' | 'status' | undefined,
          playerName: positional[1],
          json: flags['json'] === true,
        });
        break;
      }

      case 'ban': {
        // ban command: ban <server> <action> [target] [reason...]
        // subCommand = server name, positional[0] = action, positional[1] = target
        const action = positional[0];
        let ipAction: 'list' | 'add' | 'remove' | undefined;
        let target: string | undefined;
        let reason: string | undefined;

        if (action === 'ip') {
          // ban <server> ip <list|add|remove> [ip] [reason]
          ipAction = positional[1] as 'list' | 'add' | 'remove' | undefined;
          target = positional[2];
          reason = positional.slice(3).join(' ') || undefined;
        } else {
          target = positional[1];
          reason = positional.slice(2).join(' ') || undefined;
        }

        exitCode = await banCommand({
          root: rootDir,
          serverName: subCommand,
          subCommand: action as 'list' | 'add' | 'remove' | 'ip' | undefined,
          target,
          reason,
          ipAction,
          json: flags['json'] === true,
        });
        break;
      }

      case 'kick': {
        // kick command: kick <server> <player> [reason...]
        const serverName = positional[0];
        const playerName = positional[1];
        const reason = positional.slice(2).join(' ') || undefined;

        exitCode = await kickCommand({
          root: rootDir,
          serverName,
          playerName,
          reason,
          json: flags['json'] === true,
        });
        break;
      }

      case 'router': {
        if (!paths.isInitialized()) {
          log.error('Platform not initialized. Run: mcctl init');
          exitCode = 1;
          break;
        }

        switch (subCommand) {
          case 'start':
            exitCode = await shell.routerStart();
            break;
          case 'stop':
            exitCode = await shell.routerStop();
            break;
          case 'restart':
            exitCode = await shell.routerRestart();
            break;
          default:
            log.error('Usage: mcctl router <start|stop|restart>');
            exitCode = 1;
        }
        break;
      }

      case 'migrate': {
        // migrate command: migrate [worlds|status] [options]
        exitCode = await migrateCommand({
          root: rootDir,
          subCommand: subCommand,
          serverName: flags['server'] as string | undefined,
          all: flags['all'] === true,
          dryRun: flags['dry-run'] === true,
          backup: flags['backup'] === true,
          force: flags['force'] === true,
          json: flags['json'] === true,
        });
        break;
      }

      case 'mod': {
        // mod command: mod [search|add|list|remove|sources] [args...]
        // subCommand = action, positional[0] = server or query, positional[1+] = mod names
        const modSource = flags['modrinth'] ? 'modrinth' as const :
                         flags['curseforge'] ? 'curseforge' as const :
                         flags['spiget'] ? 'spiget' as const :
                         flags['url'] ? 'url' as const : 'modrinth' as const;

        exitCode = await modCommand({
          root: rootDir,
          subCommand: subCommand,
          serverName: subCommand === 'search' ? undefined : positional[0],
          query: subCommand === 'search' ? positional[0] : undefined,
          modNames: subCommand === 'search' ? undefined : positional.slice(1),
          source: modSource,
          json: flags['json'] === true,
          force: flags['force'] === true,
        });
        break;
      }

      case 'update': {
        exitCode = await updateCommand({
          check: flags['check'] === true,
          force: flags['force'] === true,
          yes: flags['yes'] === true,
          all: flags['all'] === true,
          root: rootDir,
        });
        break;
      }

      case 'admin': {
        // Show deprecation warning for 'admin' command
        log.warn('The "admin" command is deprecated. Please use "console" instead.');
        console.log(`  Example: ${colors.cyan('mcctl console init')} instead of ${colors.dim('mcctl admin init')}`);
        console.log('');
        // Route to console management handler
        exitCode = await handleConsoleCommand(subCommand, positional, flags, rootDir);
        break;
      }

      case 'audit': {
        exitCode = await auditCommand({
          subcommand: subCommand,
          limit: flags['limit'] ? parseInt(flags['limit'] as string, 10) : undefined,
          action: flags['action'] as string | undefined,
          target: flags['target'] as string | undefined,
          actor: flags['actor'] as string | undefined,
          status: flags['status'] as 'success' | 'failure' | undefined,
          from: flags['from'] as string | undefined,
          to: flags['to'] as string | undefined,
          days: flags['days'] ? parseInt(flags['days'] as string, 10) : undefined,
          before: flags['before'] as string | undefined,
          dryRun: flags['dry-run'] === true,
          force: flags['force'] === true,
          sudoPassword,
        });
        break;
      }

      case 'upgrade': {
        exitCode = await upgradeCommand({
          root: rootDir,
          dryRun: flags['dry-run'] === true,
          nonInteractive: flags['non-interactive'] === true,
        });
        break;
      }

      case 'playit': {
        // playit command: playit <start|stop|status|setup|domain>
        // subCommand = action
        exitCode = await playitCommand({
          root: rootDir,
          subCommand: subCommand as 'start' | 'stop' | 'status' | 'setup' | 'domain' | undefined,
          json: flags['json'] === true,
          domainArgs: positional,
          remove: flags['remove'] === true,
        });
        break;
      }

      case 'config-snapshot': {
        // config-snapshot command: config-snapshot <list|create|show|diff|restore|delete|schedule>
        const csAction = subCommand;

        if (csAction === 'schedule') {
          // config-snapshot schedule <list|add|remove|enable|disable>
          const scheduleAction = positional[0];

          switch (scheduleAction) {
            case 'list':
              exitCode = await configSnapshotScheduleListCommand({
                root: rootDir,
                serverName: flags['server'] as string | undefined,
                json: flags['json'] === true,
              });
              break;

            case 'add':
              exitCode = await configSnapshotScheduleAddCommand({
                root: rootDir,
                serverName: flags['server'] as string | undefined,
                cron: flags['cron'] as string | undefined,
                name: flags['name'] as string | undefined,
                retention: flags['retention']
                  ? parseInt(flags['retention'] as string, 10)
                  : undefined,
                json: flags['json'] === true,
              });
              break;

            case 'remove':
              exitCode = await configSnapshotScheduleRemoveCommand({
                root: rootDir,
                id: positional[1] ?? '',
                force: flags['force'] === true,
              });
              break;

            case 'enable':
              exitCode = await configSnapshotScheduleToggleCommand({
                root: rootDir,
                id: positional[1] ?? '',
                action: 'enable',
              });
              break;

            case 'disable':
              exitCode = await configSnapshotScheduleToggleCommand({
                root: rootDir,
                id: positional[1] ?? '',
                action: 'disable',
              });
              break;

            default:
              log.error(
                'Usage: mcctl config-snapshot schedule <list|add|remove|enable|disable>'
              );
              exitCode = 1;
          }
          break;
        }

        // Snapshot commands
        switch (csAction) {
          case 'list':
            exitCode = await configSnapshotListCommand({
              root: rootDir,
              serverName: positional[0],
              limit: flags['limit']
                ? parseInt(flags['limit'] as string, 10)
                : undefined,
              json: flags['json'] === true,
            });
            break;

          case 'create':
            exitCode = await configSnapshotCreateCommand({
              root: rootDir,
              serverName: positional[0],
              description: flags['description'] as string | undefined,
              json: flags['json'] === true,
            });
            break;

          case 'show':
            exitCode = await configSnapshotShowCommand({
              root: rootDir,
              id: positional[0] ?? '',
              files: flags['files'] === true,
              json: flags['json'] === true,
            });
            break;

          case 'diff':
            exitCode = await configSnapshotDiffCommand({
              root: rootDir,
              id1: positional[0] ?? '',
              id2: positional[1] ?? '',
              filesOnly: flags['files-only'] === true,
              json: flags['json'] === true,
            });
            break;

          case 'restore':
            exitCode = await configSnapshotRestoreCommand({
              root: rootDir,
              id: positional[0] ?? '',
              force: flags['force'] === true,
              noSafety: flags['no-safety'] === true,
            });
            break;

          case 'delete':
            exitCode = await configSnapshotDeleteCommand({
              root: rootDir,
              id: positional[0] ?? '',
              force: flags['force'] === true,
            });
            break;

          default:
            log.error(
              'Usage: mcctl config-snapshot <list|create|show|diff|restore|delete|schedule>'
            );
            exitCode = 1;
        }
        break;
      }

      default:
        log.error(`Unknown command: ${command}`);
        printUsage();
        exitCode = 1;
    }
  } catch (err) {
    log.error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    exitCode = 1;
  }

  process.exit(exitCode);
}

main();
