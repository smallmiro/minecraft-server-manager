/**
 * World (LEVEL) name rule: the single source for the CLI, API and console. A world name is a
 * directory under worlds/, so only characters safe in paths and commands.
 */
export const WORLD_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * A LEVEL that already exists in a config.env (legacy names such as
 * `My World` predate WORLD_NAME_PATTERN, #649). It is read, never written:
 * any value that names exactly one directory under worlds/ is accepted, and
 * only values that cannot be interpreted safely are rejected (path
 * separators, `.`/`..`, quotes, control characters). Writing a LEVEL still
 * requires WORLD_NAME_PATTERN.
 */
// eslint-disable-next-line no-control-regex
export const EXISTING_WORLD_NAME_PATTERN = /^(?!\.\.?$)[^/\\'"\x00-\x1f\x7f]+$/;

/**
 * WorldName Value Object
 * A validated world directory name, used as a server's LEVEL
 */
export class WorldName {
  private constructor(private readonly _value: string) {
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  /**
   * Why a world name is invalid, or undefined when it is valid.
   * Checks the exact string; create() trims first.
   */
  static validate(value: string): string | undefined {
    if (!value) {
      return 'World name cannot be empty';
    }
    if (!WORLD_NAME_PATTERN.test(value)) {
      return 'World name can only contain letters, numbers, hyphens, and underscores';
    }
    return undefined;
  }

  static create(value: string): WorldName {
    const trimmed = value.trim();
    const error = WorldName.validate(trimmed);
    if (error) {
      throw new Error(error);
    }
    return new WorldName(trimmed);
  }

  toString(): string {
    return this._value;
  }
}

type ConfigEnv = Readonly<Record<string, string | undefined>>;

/**
 * The world set in a server's config.env: LEVEL, then the legacy WORLD_NAME
 * alias. Not validated, so existing configs keep working.
 */
export function configuredWorldName(env: ConfigEnv): string | undefined {
  return env['LEVEL']?.trim() || env['WORLD_NAME']?.trim() || undefined;
}

/**
 * The world a server uses: its configured world, else itzg's runtime default
 * 'world' (with `--universe /worlds/`, that is worlds/world).
 */
export function resolveWorldName(env: ConfigEnv): string {
  return configuredWorldName(env) ?? 'world';
}
