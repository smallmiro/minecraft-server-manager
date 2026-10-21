import { ServerName, EXISTING_SERVER_NAME_PATTERN } from '@minecraft-docker/shared';

type Flags = Record<string, string | boolean | undefined>;

/** Commands whose first positional is the server name. */
const POSITIONAL_COMMANDS = new Set([
  'status', 'delete', 'start', 'stop', 'logs', 'exec', 'rcon', 'config',
  'server-backup', 'server-restore', 'kick',
]);
/** Commands whose sub-command slot holds the server name. */
const SUBCOMMAND_COMMANDS = new Set(['op', 'whitelist', 'ban']);
const PLAYER_ACTIONS = new Set(['online', 'info', 'cache', 'lookup', 'uuid']);
const CONSOLE_ACTIONS = new Set(['init', 'service', 'user', 'api', 'remove']);

/** The server-name argument of an existing-server command, if it has one. */
export function serverNameArg(
  command: string,
  subCommand: string | undefined,
  positional: string[],
  flags: Flags,
): string | undefined {
  if (POSITIONAL_COMMANDS.has(command)) {
    return flags['all'] ? undefined : positional[0];
  }
  if (SUBCOMMAND_COMMANDS.has(command)) return subCommand;
  switch (command) {
    case 'console':
      return subCommand && !CONSOLE_ACTIONS.has(subCommand) ? subCommand : undefined;
    case 'player':
      if (subCommand === 'online') return positional[0];
      return subCommand && !PLAYER_ACTIONS.has(subCommand) ? subCommand : undefined;
    case 'world':
      if (subCommand === 'new') return flags['server'] as string | undefined;
      return positional[1];
    case 'mod':
      return subCommand === 'search' ? undefined : positional[0];
    default:
      return undefined;
  }
}

/**
 * Warning text for a name that predates the strict rule but is still usable,
 * or undefined. Names the existing rule rejects are left to each command.
 */
export function legacyServerNameWarning(name: string | undefined): string | undefined {
  if (!name || !EXISTING_SERVER_NAME_PATTERN.test(name) || !ServerName.validate(name)) {
    return undefined;
  }
  return `Server name '${name}' does not follow the current naming rules (lowercase letters, numbers, hyphens); continuing anyway.`;
}
