/**
 * A value for the flag before it: not another flag, but a negative number
 * (`-s -123`) is a value. `--key=value` takes any value, even `--seed=--x` (#728).
 */
const isValue = (arg: string | undefined): arg is string =>
  !!arg && (!arg.startsWith('-') || /^-\d/.test(arg));

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

    if (arg === '--') {
      // The rest is positional, e.g. a server command: mcctl exec srv -- say -h
      result.positional.push(...args.slice(i + 1));
      break;
    } else if (arg.startsWith('--') && arg.includes('=')) {
      const eq = arg.indexOf('=');
      result.flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      i++;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      // Boolean-only flags (never take a value)
      const booleanOnlyFlags = ['all', 'json', 'help', 'version', 'force', 'yes', 'delete-world', 'follow', 'detail', 'watch', 'offline', 'no-start', 'no-whitelist', 'enable-whitelist', 'list', 'dry-run', 'api', 'console', 'build', 'no-build', 'keep-config', 'check', 'reconfigure', 'no-playit', 'no-playit-domain', 'remove', 'non-interactive', 'upgrade'];

      if (booleanOnlyFlags.includes(key)) {
        result.flags[key] = true;
        i++;
      } else if (isValue(nextArg)) {
        result.flags[key] = nextArg;
        i += 2;
      } else {
        result.flags[key] = true;
        i++;
      }
    } else if (arg.startsWith('-') && arg.length === 2 && !/^-\d$/.test(arg)) {
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
      } else if (isValue(nextArg)) {
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
