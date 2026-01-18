/**
 * Memory Value Object
 * Represents JVM memory allocation (e.g., "2G", "4G", "512M")
 */
export class Memory {
  private constructor(
    private readonly _value: string,
    private readonly _bytes: number
  ) {
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  get bytes(): number {
    return this._bytes;
  }

  get megabytes(): number {
    return Math.floor(this._bytes / (1024 * 1024));
  }

  get gigabytes(): number {
    return Math.floor(this._bytes / (1024 * 1024 * 1024));
  }

  /**
   * Returns formatted string (e.g., "4G" or "512M")
   */
  get formatted(): string {
    if (this._bytes >= 1024 * 1024 * 1024) {
      const gb = this._bytes / (1024 * 1024 * 1024);
      return Number.isInteger(gb) ? `${gb}G` : `${this.megabytes}M`;
    }
    return `${this.megabytes}M`;
  }

  static create(value: string): Memory {
    const trimmed = value.trim().toUpperCase();

    // Parse memory string: 2G, 4G, 512M, 1024M
    const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([GM])$/);

    if (!match) {
      throw new Error(
        `Invalid memory format: ${value}. Expected format: <number>G or <number>M (e.g., 4G, 512M)`
      );
    }

    const amount = parseFloat(match[1]!);
    const unit = match[2]!;

    if (amount <= 0) {
      throw new Error('Memory allocation must be greater than 0');
    }

    let bytes: number;
    if (unit === 'G') {
      bytes = amount * 1024 * 1024 * 1024;
    } else {
      bytes = amount * 1024 * 1024;
    }

    // Minimum 512M
    const minBytes = 512 * 1024 * 1024;
    if (bytes < minBytes) {
      throw new Error('Memory allocation must be at least 512M');
    }

    // Maximum 64G (reasonable limit)
    const maxBytes = 64 * 1024 * 1024 * 1024;
    if (bytes > maxBytes) {
      throw new Error('Memory allocation cannot exceed 64G');
    }

    // Normalize to canonical format
    const normalizedValue = bytes >= 1024 * 1024 * 1024
      ? `${Math.floor(bytes / (1024 * 1024 * 1024))}G`
      : `${Math.floor(bytes / (1024 * 1024))}M`;

    return new Memory(normalizedValue, bytes);
  }

  static fromGigabytes(gb: number): Memory {
    return Memory.create(`${gb}G`);
  }

  static fromMegabytes(mb: number): Memory {
    return Memory.create(`${mb}M`);
  }

  /**
   * Default memory allocation (4G)
   */
  static default(): Memory {
    return Memory.fromGigabytes(4);
  }

  /**
   * Recommended minimum for vanilla servers
   */
  static minimum(): Memory {
    return Memory.fromGigabytes(2);
  }

  /**
   * Recommended for modded servers
   */
  static forMods(): Memory {
    return Memory.fromGigabytes(6);
  }

  isGreaterThan(other: Memory): boolean {
    return this._bytes > other._bytes;
  }

  isLessThan(other: Memory): boolean {
    return this._bytes < other._bytes;
  }

  equals(other: Memory): boolean {
    return this._bytes === other._bytes;
  }

  toString(): string {
    return this._value;
  }
}
