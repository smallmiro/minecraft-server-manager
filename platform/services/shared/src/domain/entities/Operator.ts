import { OpLevel } from '../value-objects/OpLevel.js';

/**
 * Minecraft ops.json file format
 */
export interface MinecraftOpsJson {
  uuid: string;
  name: string;
  level: number;
  bypassesPlayerLimit: boolean;
}

/**
 * Operator entity data for creation
 */
export interface OperatorData {
  uuid: string;
  name: string;
  level: OpLevel;
  bypassesPlayerLimit?: boolean;
}

/**
 * Operator entity
 * Represents a Minecraft operator with permission level
 */
export class Operator {
  private readonly _uuid: string;
  private readonly _name: string;
  private _level: OpLevel;
  private _bypassesPlayerLimit: boolean;

  private constructor(data: OperatorData) {
    if (!data.uuid || data.uuid.trim().length === 0) {
      throw new Error('UUID is required');
    }
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Name is required');
    }

    this._uuid = data.uuid;
    this._name = data.name;
    this._level = data.level;
    this._bypassesPlayerLimit = data.bypassesPlayerLimit ?? false;
  }

  // Getters
  get uuid(): string {
    return this._uuid;
  }

  get name(): string {
    return this._name;
  }

  get level(): OpLevel {
    return this._level;
  }

  get bypassesPlayerLimit(): boolean {
    return this._bypassesPlayerLimit;
  }

  /**
   * Update the operator's level
   */
  updateLevel(newLevel: OpLevel): void {
    this._level = newLevel;
  }

  /**
   * Set whether this operator bypasses player limit
   */
  setBypassesPlayerLimit(value: boolean): void {
    this._bypassesPlayerLimit = value;
  }

  /**
   * Check if this operator has permission of the given level or higher
   */
  hasPermission(requiredLevel: OpLevel): boolean {
    return this._level.value >= requiredLevel.value;
  }

  /**
   * Create a new Operator entity
   */
  static create(data: OperatorData): Operator {
    return new Operator(data);
  }

  /**
   * Create an Operator from Minecraft ops.json format
   */
  static fromMinecraftOpsJson(json: MinecraftOpsJson): Operator {
    return new Operator({
      uuid: json.uuid,
      name: json.name,
      level: OpLevel.from(json.level),
      bypassesPlayerLimit: json.bypassesPlayerLimit,
    });
  }

  /**
   * Convert to Minecraft ops.json format
   */
  toMinecraftOpsJson(): MinecraftOpsJson {
    return {
      uuid: this._uuid,
      name: this._name,
      level: this._level.value,
      bypassesPlayerLimit: this._bypassesPlayerLimit,
    };
  }
}
