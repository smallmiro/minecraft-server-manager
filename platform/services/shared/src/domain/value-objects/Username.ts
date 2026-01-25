/**
 * Username Value Object
 * Represents a validated username (3-50 characters, alphanumeric + underscore)
 */
export class Username {
  private static readonly MIN_LENGTH = 3;
  private static readonly MAX_LENGTH = 50;
  // Alphanumeric characters and underscores only
  private static readonly PATTERN = /^[a-zA-Z0-9_]+$/;

  private constructor(private readonly _value: string) {
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  static create(value: string): Username {
    const trimmed = value.trim();

    if (!trimmed) {
      throw new Error('Username cannot be empty');
    }

    if (trimmed.length < Username.MIN_LENGTH) {
      throw new Error(
        `Username must be at least ${Username.MIN_LENGTH} characters`
      );
    }

    if (trimmed.length > Username.MAX_LENGTH) {
      throw new Error(
        `Username cannot exceed ${Username.MAX_LENGTH} characters`
      );
    }

    if (!Username.PATTERN.test(trimmed)) {
      throw new Error(
        'Username must contain only alphanumeric characters and underscores'
      );
    }

    // Username must start with a letter
    if (!/^[a-zA-Z]/.test(trimmed)) {
      throw new Error('Username must start with a letter');
    }

    return new Username(trimmed);
  }

  equals(other: Username): boolean {
    // Case-insensitive comparison for usernames
    return this._value.toLowerCase() === other._value.toLowerCase();
  }

  toString(): string {
    return this._value;
  }
}
