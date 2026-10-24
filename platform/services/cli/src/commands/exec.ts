import { Paths, log, type IServerConsolePort } from '@minecraft-docker/shared';
import { getContainer } from '../infrastructure/index.js';
import { getContainerName, serverOfContainer } from '../lib/rcon.js';

export interface ExecCommandOptions {
  root?: string;
  serverName?: string;
  command?: string[];
  console?: Pick<IServerConsolePort, 'command'>;
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

  const consolePort = options.console ?? getContainer(options.root).serverConsolePort;
  const result = await consolePort.command(serverOfContainer(getContainerName(options.serverName)), options.command);
  // The caller exits right after; wait until a pipe has taken the whole reply
  if (result.stdout) await write(process.stdout, result.stdout);
  if (result.stderr) await write(process.stderr, result.stderr);
  return result.exitCode;
}

function write(stream: NodeJS.WriteStream, text: string): Promise<void> {
  return new Promise((resolve) => stream.write(text, () => resolve()));
}
