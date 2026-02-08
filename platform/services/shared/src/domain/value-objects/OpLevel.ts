/**
 * OpLevel Value Object
 * Represents a validated Minecraft operator permission level (1-4)
 */
export class OpLevel {
  static readonly MODERATOR = new OpLevel(1, 'Moderator');
  static readonly GAMEMASTER = new OpLevel(2, 'Gamemaster');
  static readonly ADMIN = new OpLevel(3, 'Admin');
  static readonly OWNER = new OpLevel(4, 'Owner');

  private static readonly DESCRIPTIONS: Record<number, string> = {
    1: 'Bypass spawn protection, interact with blocks in protected areas',
    2: 'Level 1 + /gamemode, /give, /summon, /clear, command blocks',
    3: 'Level 2 + /op, /deop, /kick, /ban, /whitelist',
    4: 'Level 3 + /stop, /save-all, /save-on, /save-off, full server control',
  };

  private constructor(
    public readonly value: number,
    public readonly label: string
  ) {
    Object.freeze(this);
  }

  /**
   * Create an OpLevel from a numeric value
   * @param level - Numeric level between 1 and 4
   * @throws Error if level is not a valid integer between 1 and 4
   */
  static from(level: number): OpLevel {
    if (!Number.isInteger(level) || level < 1 || level > 4) {
      throw new Error(`Invalid OP level: ${level}. Must be between 1 and 4`);
    }

    switch (level) {
      case 1:
        return OpLevel.MODERATOR;
      case 2:
        return OpLevel.GAMEMASTER;
      case 3:
        return OpLevel.ADMIN;
      case 4:
        return OpLevel.OWNER;
      default:
        throw new Error(`Invalid OP level: ${level}. Must be between 1 and 4`);
    }
  }

  /**
   * Get the description of capabilities for this OP level
   */
  get description(): string {
    const desc = OpLevel.DESCRIPTIONS[this.value];
    if (!desc) {
      throw new Error(`No description found for OP level ${this.value}`);
    }
    return desc;
  }

  /**
   * Check equality with another OpLevel
   */
  equals(other: OpLevel): boolean {
    return this.value === other.value;
  }

  /**
   * String representation: "level (label)"
   */
  toString(): string {
    return `${this.value} (${this.label})`;
  }
}
