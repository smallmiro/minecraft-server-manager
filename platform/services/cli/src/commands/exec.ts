import { Paths, log } from '@minecraft-docker/shared';
import { ShellExecutor } from '../lib/shell.js';

export interface ExecCommandOptions {
  root?: string;
  serverName?: string;
  command?: string[];
}

/**
 * Execute RCON command on a server
 */
export async function execCommand(options: ExecCommandOptions): Promise<number> {
  const paths = new Paths(options.root);

  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  if (!options.serverName) {
    log.error('Server name is required');
    log.info('Usage: mcctl exec <server> <command...>');
    return 1;
  }

  if (!options.command || options.command.length === 0) {
    log.error('Command is required');
    log.info('Usage: mcctl exec <server> <command...>');
    log.info('Examples:');
    log.info('  mcctl exec myserver say "Hello!"');
    log.info('  mcctl exec myserver give Player diamond 64');
    log.info('  mcctl exec myserver list');
    return 1;
  }

  const shell = new ShellExecutor(paths);
  return shell.execRcon(options.serverName, options.command);
}
