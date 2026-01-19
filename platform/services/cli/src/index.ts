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
  ${colors.bold('create')} <name> [options]    Create a new server
  ${colors.bold('delete')} <name> [--force]    Delete a server (preserves world data)
  ${colors.bold('status')} [--json]            Show status of all servers
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

${colors.cyan('World Management:')}
  ${colors.bold('world list')} [--json]        List worlds and lock status
  ${colors.bold('world assign')} <world> <srv> Lock world to server
  ${colors.bold('world release')} <world>      Release world lock

${colors.cyan('Player Lookup:')}
  ${colors.bold('player lookup')} <name>       Look up player info
  ${colors.bold('player uuid')} <name>         Get player UUID
  ${colors.bold('player uuid')} <name> --offline  Get offline UUID

${colors.cyan('Backup (requires .env config):')}
  ${colors.bold('backup push')} [--message]    Backup worlds to GitHub
  ${colors.bold('backup status')}              Show backup configuration
  ${colors.bold('backup history')} [--json]    Show backup history
  ${colors.bold('backup restore')} <commit>    Restore from commit

${colors.cyan('Create Options:')}
  -t, --type TYPE            Server type: PAPER, VANILLA, FORGE, FABRIC
  -v, --version VERSION      Minecraft version (e.g., 1.21.1)
  -s, --seed NUMBER          World seed
  -u, --world-url URL        Download world from ZIP URL
  -w, --world NAME           Use existing world (symlink)
  --no-start                 Create without starting

${colors.cyan('Global Options:')}
  --root <path>              Custom data directory
  --json                     Output in JSON format
  -h, --help                 Show this help
  --version                  Show version

${colors.cyan('Examples:')}
  mcctl init
  mcctl up                           # Start everything
  mcctl down                         # Stop everything
  mcctl start --all                  # Start all MC servers
  mcctl stop --all                   # Stop all MC servers
  mcctl create myserver -t FORGE -v 1.20.4
  mcctl status --json
  mcctl logs myserver -f
  mcctl exec myserver say "Hello!"   # Execute RCON command
  mcctl exec myserver list           # List online players
  mcctl config myserver              # View all config
  mcctl config myserver --cheats     # Enable cheats
  mcctl config myserver MOTD "Welcome!"  # Set MOTD
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

      if (nextArg && !nextArg.startsWith('-')) {
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
      };

      const longKey = flagMap[key] ?? key;

      if (nextArg && !nextArg.startsWith('-')) {
        result.flags[longKey] = nextArg;
        i += 2;
      } else {
        result.flags[longKey] = true;
        i++;
      }
    } else {
      if (!result.command) {
        result.command = arg;
      } else if (!result.subCommand && ['world', 'player', 'backup'].includes(result.command)) {
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
  const paths = new Paths(rootDir);
  const shell = new ShellExecutor(paths);

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
          serverName: positional[1],
          json: flags['json'] === true,
          force: flags['force'] === true,
        });
        break;
      }

      case 'player': {
        const playerArgs = [subCommand ?? 'lookup', ...positional];
        if (flags['json']) playerArgs.push('--json');
        if (flags['offline']) playerArgs.push('--offline');

        exitCode = await shell.player(playerArgs);
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
