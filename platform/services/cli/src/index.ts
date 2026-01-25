#!/usr/bin/env node

import { Paths, log, colors } from '@minecraft-docker/shared';
import {
  initCommand,
  statusCommand,
  createCommand,
  deleteCommand,
  worldCommand,
  backupCommand,
  execCommand,
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
  adminServiceCommand,
} from './commands/index.js';
import { ShellExecutor } from './lib/shell.js';

const VERSION = '0.1.0';

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
${colors.bold('mcctl')} - Minecraft Server Management CLI

${colors.cyan('Usage:')}
  mcctl <command> [options]

${colors.cyan('Commands:')}
  ${colors.bold('init')}                       Initialize platform (~/.minecraft-servers)
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
  ${colors.bold('console')} <server>           Connect to RCON console
  ${colors.bold('exec')} <server> <cmd...>     Execute RCON command
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
  list                    List current operators
  add <player>            Add operator (RCON + config)
  remove <player>         Remove operator

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

${colors.cyan('World Backup (requires .env config):')}
  ${colors.bold('backup push')} [--message]    Backup worlds to GitHub
  ${colors.bold('backup status')}              Show backup configuration
  ${colors.bold('backup history')} [--json]    Show backup history
  ${colors.bold('backup restore')} <commit>    Restore from commit

${colors.cyan('Migration:')}
  ${colors.bold('migrate worlds')}             Migrate worlds to shared directory
  ${colors.bold('migrate status')}             Check migration status
  ${colors.bold('migrate worlds')} --all       Migrate all servers
  ${colors.bold('migrate worlds')} --dry-run   Preview changes without applying

${colors.cyan('Admin Service:')}
  ${colors.bold('admin service start')}        Start API + Console services
  ${colors.bold('admin service start')} --api-only    Start API only
  ${colors.bold('admin service start')} --console-only Start Console only
  ${colors.bold('admin service stop')}         Stop admin services
  ${colors.bold('admin service restart')}      Restart admin services
  ${colors.bold('admin service status')}       Show service status
  ${colors.bold('admin service logs')} [-f]    View logs (--api, --console)

${colors.cyan('Create Options:')}
  -t, --type TYPE            Server type: PAPER, VANILLA, FORGE, FABRIC
  -v, --version VERSION      Minecraft version (e.g., 1.21.1)
  -s, --seed NUMBER          World seed
  -u, --world-url URL        Download world from ZIP URL
  -w, --world NAME           Use existing world (symlink)
  --no-start                 Create without starting

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
  mcctl status --json
  mcctl status --detail              # Show detailed info
  mcctl status --watch               # Real-time monitoring
  mcctl status --watch --interval 2  # Watch with 2s refresh
  mcctl status myserver              # Single server status
  mcctl status router                # mc-router status
  mcctl logs myserver -f
  mcctl exec myserver say "Hello!"   # Execute RCON command
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
      const booleanOnlyFlags = ['all', 'json', 'help', 'version', 'force', 'yes', 'follow', 'detail', 'watch', 'offline', 'no-start', 'list', 'dry-run'];

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
      } else if (!result.subCommand && ['world', 'player', 'backup', 'op', 'whitelist', 'ban', 'router', 'migrate', 'mod', 'admin'].includes(result.command)) {
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

  if (flags['version'] || command === '--version') {
    console.log(`mcctl version ${VERSION}`);
    process.exit(0);
  }

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
          sudoPassword,
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
        break;
      }

      case 'console':
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
        // Use new interactive backup command
        exitCode = await backupCommand({
          root: rootDir,
          subCommand: subCommand,
          message: flags['message'] as string | undefined,
          commitHash: positional[0],
          json: flags['json'] === true,
          auto: flags['auto'] === true,
        });
        break;
      }

      case 'op': {
        // op command: op <server> <action> [player]
        // parseArgs treats second arg as subCommand, so:
        // subCommand = server name, positional[0] = action, positional[1] = player
        exitCode = await opCommand({
          root: rootDir,
          serverName: subCommand,
          subCommand: positional[0] as 'add' | 'remove' | 'list' | undefined,
          playerName: positional[1],
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

      case 'admin': {
        // admin command: admin <subcommand> [options]
        // subCommand = service, positional[0] = action (start/stop/restart/status/logs)
        if (subCommand === 'service') {
          exitCode = await adminServiceCommand({
            root: rootDir,
            subCommand: positional[0] as 'start' | 'stop' | 'restart' | 'status' | 'logs' | undefined,
            apiOnly: flags['api-only'] === true || flags['api'] === true,
            consoleOnly: flags['console-only'] === true || flags['console'] === true,
            follow: flags['follow'] === true,
            json: flags['json'] === true,
          });
        } else {
          log.error('Usage: mcctl admin service <start|stop|restart|status|logs>');
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
