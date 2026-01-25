/**
 * UserId Value Object
 * Represents a validated UUID-based user identifier
 */
export class UserId {
  private static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private constructor(private readonly _value: string) {
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  /**
   * Create a UserId from an existing UUID string
   */
  static create(value: string): UserId {
    const trimmed = value.trim().toLowerCase();

    if (!trimmed) {
      throw new Error('User ID cannot be empty');
    }

    if (!UserId.UUID_REGEX.test(trimmed)) {
      throw new Error('User ID must be a valid UUID format');
    }

    return new UserId(trimmed);
  }

  /**
   * Generate a new random UserId
   */
  static generate(): UserId {
    // Use crypto.randomUUID() for UUID v4 generation
    const uuid = crypto.randomUUID();
    return new UserId(uuid.toLowerCase());
  }

  equals(other: UserId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
