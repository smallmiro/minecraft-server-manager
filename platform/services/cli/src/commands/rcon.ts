import { spawn } from 'node:child_process';
import { Paths, log } from '@minecraft-docker/shared';
import { getContainerName, isContainerRunning } from '../lib/rcon.js';

export interface RconCommandOptions {
  serverName?: string;
  root?: string;
}

/**
 * Connect to interactive RCON console for a Minecraft server
 *
 * This command opens an interactive RCON session where you can
 * execute multiple commands in sequence. Use 'exit' or Ctrl+C to quit.
 *
 * For single command execution, use `mcctl exec <server> <cmd>` instead.
 */
export async function rconCommand(options: RconCommandOptions): Promise<number> {
  const paths = new Paths(options.root);

  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  if (!options.serverName) {
    log.error('Server name is required');
    log.info('Usage: mcctl rcon <server>');
    log.info('');
    log.info('Opens an interactive RCON console for the specified server.');
    log.info('Type "help" to see available commands, "exit" or Ctrl+C to quit.');
    log.info('');
    log.info('For single command execution, use: mcctl exec <server> <command>');
    return 1;
  }

  const containerName = getContainerName(options.serverName);

  if (!(await isContainerRunning(containerName))) {
    log.error(`Server '${options.serverName}' is not running`);
    log.info(`Start the server first: mcctl start ${options.serverName}`);
    return 1;
  }

  log.info(`Connecting to RCON console for '${options.serverName}'...`);
  log.info('Type "help" for commands, Ctrl+C or "exit" to quit');
  console.log(''); // Empty line before RCON prompt

  return new Promise((resolve) => {
    const child = spawn('docker', ['exec', '-it', containerName, 'rcon-cli'], {
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      // Exit code 130 = Ctrl+C, treat as normal exit
      resolve(code === 130 ? 0 : (code ?? 0));
    });

    child.on('error', (err) => {
      log.error(`Failed to connect to RCON: ${err.message}`);
      resolve(1);
    });
  });
}
