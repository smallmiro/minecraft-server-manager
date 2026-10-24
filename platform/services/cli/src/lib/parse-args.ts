/**
 * Parse command line arguments
 */
export function parseArgs(args: string[]): {
  command: string;
  subCommand?: string;
  subCommandArgs: string[];
  positional: string[];
  flags: Record<string, string | boolean>;
} {
  const result = {
    command: '',
    subCommand: undefined as string | undefined,
    subCommandArgs: [] as string[],
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
      const booleanOnlyFlags = ['all', 'json', 'help', 'version', 'force', 'yes', 'delete-world', 'follow', 'detail', 'watch', 'offline', 'no-start', 'no-whitelist', 'enable-whitelist', 'list', 'dry-run', 'api', 'console', 'build', 'no-build', 'keep-config', 'check', 'reconfigure', 'no-playit', 'no-playit-domain', 'remove', 'non-interactive', 'upgrade'];

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
        result.subCommandArgs = args.slice(i + 1);
      } else {
        result.positional.push(arg);
      }
      i++;
    }
  }

  return result;
}
