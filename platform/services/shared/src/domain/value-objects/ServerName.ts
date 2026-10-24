import { containerNameOf } from '../../infrastructure/adapters/workloadNames.js';

/**
 * Server name rules: the single source for the CLI, API and console.
 *
 * New names are DNS-1123 labels that start with a letter, so the runtime's
 * workload name (infrastructure/adapters/workloadNames.ts) stays a valid
 * container and Kubernetes resource name (<= 63 chars, with room for
 * pod/StatefulSet suffixes).
 */
export const SERVER_NAME_MIN_LENGTH = 2;
export const SERVER_NAME_MAX_LENGTH = 32;

/** Names whose runtime workload collides with a platform service. */
export const RESERVED_SERVER_NAMES: readonly string[] = ['router'];

/** The whole new-name rule as one regex, for JSON schemas and clients. */
// Plain string concatenation on purpose: Next's SWC minifier mangles the
// template-literal form of this expression (drops ")$)") when it is bundled.
export const SERVER_NAME_PATTERN = new RegExp(
  '^(?!(?:' + RESERVED_SERVER_NAMES.join('|') + ')$)' +
    '(?=.{' + SERVER_NAME_MIN_LENGTH + ',' + SERVER_NAME_MAX_LENGTH + '}$)' +
    '[a-z](?:-?[a-z0-9])*$'
);

/**
 * Names that servers created before the unified rule may carry (the old
 * API/actions rule). Path- and shell-safe; operations on existing servers
 * accept these and only warn, creation requires SERVER_NAME_PATTERN.
 */
export const EXISTING_SERVER_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

/**
 * ServerName Value Object
 * Represents a validated Minecraft server name
 */
export class ServerName {
  private constructor(private readonly _value: string) {
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  /**
   * Why a new server name is invalid, or undefined when it is valid.
   * Checks the exact string; create() trims and lowercases first.
   */
  static validate(value: string): string | undefined {
    if (!value) {
      return 'Server name cannot be empty';
    }
    if (value.length < SERVER_NAME_MIN_LENGTH) {
      return `Server name must be at least ${SERVER_NAME_MIN_LENGTH} characters`;
    }
    if (value.length > SERVER_NAME_MAX_LENGTH) {
      return `Server name cannot exceed ${SERVER_NAME_MAX_LENGTH} characters`;
    }
    // Only allow lowercase letters, numbers, and hyphens
    if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(value)) {
      return 'Server name must start with a letter, end with a letter or number, and contain only lowercase letters, numbers, and hyphens';
    }
    if (/--/.test(value)) {
      return 'Server name cannot contain consecutive hyphens';
    }
    if (RESERVED_SERVER_NAMES.includes(value)) {
      return `Server name '${value}' is reserved (conflicts with the ${containerNameOf(value)} container)`;
    }
    return undefined;
  }

  /** A new server name (strict rule). */
  static create(value: string): ServerName {
    const trimmed = value.trim().toLowerCase();
    const error = ServerName.validate(trimmed);
    if (error) {
      throw new Error(error);
    }
    return new ServerName(trimmed);
  }

  /**
   * The name of a server that already exists. Accepts names that predate the
   * strict rule unchanged (callers may warn via validate()); rejects only
   * names that are unsafe to use in paths or commands.
   */
  static fromExisting(value: string): ServerName {
    if (!EXISTING_SERVER_NAME_PATTERN.test(value)) {
      throw new Error(`Invalid server name '${value}'`);
    }
    return new ServerName(value);
  }

  equals(other: ServerName): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
