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
   * Server name with mc- prefix for Docker container/service naming
   */
  get containerName(): string {
    return `mc-${this._value}`;
  }

  /**
   * Server hostname for mc-router (e.g., myserver.local)
   */
  get hostname(): string {
    return `${this._value}.local`;
  }

  /**
   * Why a new server name is invalid, or undefined when it is valid.
   * Checks the exact string; create() trims and lowercases first.
   */
  static validate(value: string): string | undefined {
    if (!value) {
      return 'Server name cannot be empty';
    }
    if (value.length < 2) {
      return 'Server name must be at least 2 characters';
    }
    if (value.length > 32) {
      return 'Server name cannot exceed 32 characters';
    }
    // Only allow lowercase letters, numbers, and hyphens
    if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(value)) {
      return 'Server name must start with a letter, end with a letter or number, and contain only lowercase letters, numbers, and hyphens';
    }
    if (/--/.test(value)) {
      return 'Server name cannot contain consecutive hyphens';
    }
    return undefined;
  }

  static create(value: string): ServerName {
    const trimmed = value.trim().toLowerCase();
    const error = ServerName.validate(trimmed);
    if (error) {
      throw new Error(error);
    }
    return new ServerName(trimmed);
  }

  equals(other: ServerName): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
