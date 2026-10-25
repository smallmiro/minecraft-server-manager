/**
 * A value for the flag before it: not another flag, but a negative number
 * (`-s -123`) is a value. `--key=value` takes any value, even `--seed=--x` (#728).
 */
const isValue = (arg: string | undefined): arg is string =>
  !!arg && (!arg.startsWith('-') || /^-\d/.test(arg));

/** Boolean-only flags (never take a value) */
const BOOLEAN_ONLY_FLAGS = ['all', 'json', 'help', 'version', 'force', 'yes', 'delete-world', 'follow', 'detail', 'watch', 'offline', 'no-start', 'no-whitelist', 'enable-whitelist', 'list', 'dry-run', 'api', 'console', 'build', 'no-build', 'keep-config', 'check', 'reconfigure', 'no-playit', 'remove', 'non-interactive', 'upgrade', 'modrinth', 'curseforge', 'spiget', 'url'];

/** `--version` is a boolean only before the command (`mcctl --version`); after it, it carries a value. */
const isBooleanOnly = (key: string, hasCommand: boolean): boolean =>
  BOOLEAN_ONLY_FLAGS.includes(key) && !(key === 'version' && hasCommand);

/** A flag value as an integer: undefined when absent, an error naming the flag when it is not one. */
export function intFlag(name: string, value: string | boolean | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) throw new Error(`--${name} must be an integer`);
  return parseInt(value, 10);
}

/** Drop `--root <path>` / `--root=<path>`, for sub-parsers (Commander) that do not know it. */
export function stripRootFlag(args: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root') i++;
    else if (!args[i]!.startsWith('--root=')) out.push(args[i]!);
  }
  return out;
}

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
      const key = arg.slice(2, eq);
      const value = arg.slice(eq + 1);
      // Only true/false become booleans: --version=1.21.1 stays a value, --force=0 never forces
      result.flags[key] = BOOLEAN_ONLY_FLAGS.includes(key) && (value === 'true' || value === 'false') ? value === 'true' : value;
      i++;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (isBooleanOnly(key, !!result.command)) {
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
      } else if (!result.subCommand && ['world', 'player', 'backup', 'op', 'whitelist', 'ban', 'router', 'migrate', 'mod', 'console', 'admin', 'playit', 'config-snapshot', 'audit'].includes(result.command)) {
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
