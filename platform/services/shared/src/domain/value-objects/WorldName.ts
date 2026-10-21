/**
 * World (LEVEL) name rule: the single source for the CLI, API and scripts
 * (platform/scripts/lib/common.sh mirrors it in bash). A world name is a
 * directory under worlds/, so only characters safe in paths and commands.
 */
export const WORLD_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

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

  static create(value: string): WorldName {
    const trimmed = value.trim();

    if (!trimmed) {
      throw new Error('World name cannot be empty');
    }

    if (!WORLD_NAME_PATTERN.test(trimmed)) {
      throw new Error('World name can only contain letters, numbers, hyphens, and underscores');
    }

    return new WorldName(trimmed);
  }

  toString(): string {
    return this._value;
  }
}

type ConfigEnv = Readonly<Record<string, string | undefined>>;

/**
 * The world a server uses, from its config.env: LEVEL, then the legacy
 * WORLD_NAME alias, then the server name (its default worlds/<server>).
 * Not validated, so existing configs keep working.
 */
export function resolveWorldName(env: ConfigEnv, serverName: string): string;
export function resolveWorldName(env: ConfigEnv, serverName?: string): string | undefined;
export function resolveWorldName(env: ConfigEnv, serverName?: string): string | undefined {
  return env['LEVEL']?.trim() || env['WORLD_NAME']?.trim() || serverName;
}
