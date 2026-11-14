import { parseRconPlayerList, type ConsoleCommandResult, type IServerConsolePort } from '@minecraft-docker/shared';

/**
 * Result of an RCON command execution
 */
export interface RconResult {
  exitCode: number;
  output: string;
}

/**
 * Get container name from server name
 * Ensures the container name has the 'mc-' prefix
 */
export function getContainerName(serverName: string): string {
  return serverName.startsWith('mc-') ? serverName : `mc-${serverName}`;
}

/** How long an RCON command may run before it is aborted (#672). */
export const RCON_TIMEOUT_MS = 30_000;

/**
 * Run one RCON command through the console port (#875), aborting it after
 * `timeoutMs`. null when it timed out. rcon-cli gets the command as one
 * argument after its '--', so a command starting with '-' is never a flag (#728).
 */
export async function runRcon(
  serverConsole: IServerConsolePort,
  containerName: string,
  command: string,
  timeoutMs: number = RCON_TIMEOUT_MS
): Promise<ConsoleCommandResult | null> {
  const signal = AbortSignal.timeout(timeoutMs);
  const result = await serverConsole.command(getContainerName(containerName), [command], { signal });
  return signal.aborted ? null : result;
}

/** Execute an RCON command: stdout, or stderr when stdout is empty. A timeout is exit code 1. */
export async function execRcon(
  serverConsole: IServerConsolePort,
  containerName: string,
  command: string,
  timeoutMs: number = RCON_TIMEOUT_MS
): Promise<RconResult> {
  const result = await runRcon(serverConsole, containerName, command, timeoutMs);
  if (!result) return { exitCode: 1, output: `RCON command timed out after ${timeoutMs} ms` };
  return { exitCode: result.exitCode, output: result.stdout || result.stderr };
}

/**
 * Execute RCON command by server name (convenience wrapper)
 */
export async function execRconCommand(
  serverConsole: IServerConsolePort,
  serverName: string,
  command: string
): Promise<string> {
  const result = await execRcon(serverConsole, serverName, command);
  return result.output.trim();
}

/**
 * Parse player list from RCON response (delegates to the shared parser, which
 * strips ANSI codes). Unparseable responses fall back to an empty 20-slot list.
 */
export function parsePlayerList(response: string): { online: number; max: number; players: string[] } {
  return parseRconPlayerList(response) ?? { online: 0, max: 20, players: [] };
}
