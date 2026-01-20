import { Paths, log, colors } from '@minecraft-docker/shared';
import { ShellExecutor } from '../lib/shell.js';
import { isContainerRunning, execRconWithOutput, getContainerName } from '../lib/rcon.js';

export interface KickCommandOptions {
  root?: string;
  serverName?: string;
  playerName?: string;
  reason?: string;
  json?: boolean;
}

/**
 * Kick a player from the server
 */
export async function kickCommand(options: KickCommandOptions): Promise<number> {
  const paths = new Paths(options.root);

  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  if (!options.serverName) {
    log.error('Server name is required');
    log.info('Usage: mcctl kick <server> <player> [reason]');
    return 1;
  }

  if (!options.playerName) {
    log.error('Player name is required');
    log.info('Usage: mcctl kick <server> <player> [reason]');
    return 1;
  }

  const shell = new ShellExecutor(paths);
  const config = shell.readConfig(options.serverName);

  if (config === null) {
    log.error(`Server '${options.serverName}' not found`);
    return 1;
  }

  const containerName = getContainerName(options.serverName);
  const isRunning = await isContainerRunning(containerName);

  if (!isRunning) {
    if (options.json) {
      console.log(
        JSON.stringify({
          success: false,
          error: 'server_not_running',
          server: options.serverName,
        })
      );
    } else {
      log.error('Server is not running. Cannot kick players from a stopped server.');
    }
    return 1;
  }

  const playerName = options.playerName;
  const reason = options.reason || 'Kicked by operator';

  // Execute kick via RCON
  const rconCmd = reason ? ['kick', playerName, reason] : ['kick', playerName];
  const result = await execRconWithOutput(containerName, rconCmd);

  if (options.json) {
    console.log(
      JSON.stringify({
        success: result.code === 0,
        player: playerName,
        reason,
        server: options.serverName,
        message: result.output.trim(),
      })
    );
  } else {
    if (result.code === 0) {
      console.log(colors.green(`${playerName} has been kicked from the server`));
      if (reason !== 'Kicked by operator') {
        console.log(colors.dim(`Reason: ${reason}`));
      }
    } else {
      log.error(`Failed to kick player: ${result.output.trim()}`);
    }
  }

  return result.code === 0 ? 0 : 1;
}
