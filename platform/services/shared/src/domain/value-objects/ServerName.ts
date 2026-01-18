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

  static create(value: string): ServerName {
    const trimmed = value.trim().toLowerCase();

    if (!trimmed) {
      throw new Error('Server name cannot be empty');
    }

    if (trimmed.length < 2) {
      throw new Error('Server name must be at least 2 characters');
    }

    if (trimmed.length > 32) {
      throw new Error('Server name cannot exceed 32 characters');
    }

    // Only allow lowercase letters, numbers, and hyphens
    if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(trimmed) && trimmed.length > 1) {
      throw new Error(
        'Server name must start with a letter, end with a letter or number, and contain only lowercase letters, numbers, and hyphens'
      );
    }

    // Single character check
    if (trimmed.length === 2 && !/^[a-z][a-z0-9]$/.test(trimmed)) {
      throw new Error('Server name must start with a letter');
    }

    // No consecutive hyphens
    if (/--/.test(trimmed)) {
      throw new Error('Server name cannot contain consecutive hyphens');
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
