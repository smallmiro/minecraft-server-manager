/**
 * McVersion Value Object
 * Represents a validated Minecraft version
 */
export class McVersion {
  private constructor(
    private readonly _value: string,
    private readonly _major: number,
    private readonly _minor: number,
    private readonly _patch: number
  ) {
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  get major(): number {
    return this._major;
  }

  get minor(): number {
    return this._minor;
  }

  get patch(): number {
    return this._patch;
  }

  /**
   * Returns the recommended Java version for this Minecraft version
   */
  get recommendedJavaVersion(): number {
    // Minecraft 1.21+ requires Java 21
    if (this._major >= 1 && this._minor >= 21) {
      return 21;
    }
    // Minecraft 1.18-1.20.x requires Java 17
    if (this._major >= 1 && this._minor >= 18) {
      return 17;
    }
    // Minecraft 1.17 requires Java 16
    if (this._major >= 1 && this._minor === 17) {
      return 16;
    }
    // Older versions use Java 8
    return 8;
  }

  /**
   * Check if this version is compatible with Java version
   */
  isCompatibleWithJava(javaVersion: number): boolean {
    return javaVersion >= this.recommendedJavaVersion;
  }

  static create(value: string): McVersion {
    const trimmed = value.trim();

    // Special case for "LATEST"
    if (trimmed.toUpperCase() === 'LATEST') {
      return new McVersion('LATEST', 0, 0, 0);
    }

    // Parse semantic version: 1.21.1, 1.20, 1.19.4
    const versionMatch = trimmed.match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);

    if (!versionMatch) {
      throw new Error(
        `Invalid Minecraft version format: ${value}. Expected format: X.Y or X.Y.Z (e.g., 1.21 or 1.21.1)`
      );
    }

    const major = parseInt(versionMatch[1]!, 10);
    const minor = parseInt(versionMatch[2]!, 10);
    const patch = versionMatch[3] ? parseInt(versionMatch[3], 10) : 0;

    // Minecraft versions start at 1.0
    if (major < 1) {
      throw new Error('Minecraft major version must be at least 1');
    }

    // Current versions are around 1.21, so limit to reasonable range
    if (major === 1 && (minor < 0 || minor > 99)) {
      throw new Error('Minecraft minor version must be between 0 and 99');
    }

    if (patch < 0 || patch > 99) {
      throw new Error('Minecraft patch version must be between 0 and 99');
    }

    return new McVersion(trimmed, major, minor, patch);
  }

  static latest(): McVersion {
    return new McVersion('LATEST', 0, 0, 0);
  }

  /**
   * Compare versions
   * Returns: negative if this < other, 0 if equal, positive if this > other
   */
  compareTo(other: McVersion): number {
    // LATEST is always considered newest
    if (this._value === 'LATEST' && other._value !== 'LATEST') return 1;
    if (this._value !== 'LATEST' && other._value === 'LATEST') return -1;
    if (this._value === 'LATEST' && other._value === 'LATEST') return 0;

    if (this._major !== other._major) {
      return this._major - other._major;
    }
    if (this._minor !== other._minor) {
      return this._minor - other._minor;
    }
    return this._patch - other._patch;
  }

  isNewerThan(other: McVersion): boolean {
    return this.compareTo(other) > 0;
  }

  isOlderThan(other: McVersion): boolean {
    return this.compareTo(other) < 0;
  }

  equals(other: McVersion): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
