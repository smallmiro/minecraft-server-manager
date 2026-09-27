/**
 * Player entity data for creation
 */
export interface PlayerProps {
  /** Minecraft UUID. May be '' for an online-only player with no known file record. */
  uuid: string;
  name: string;
  /** Last known activity time (playerdata mtime), or null when unknown. */
  lastSeen: Date | null;
  isOp: boolean;
  isBanned: boolean;
  isWhitelisted: boolean;
  online: boolean;
}

/**
 * Plain-serializable representation of a Player.
 */
export interface PlayerJson {
  uuid: string;
  name: string;
  lastSeen: string | null;
  isOp: boolean;
  isBanned: boolean;
  isWhitelisted: boolean;
  online: boolean;
}

/**
 * Player entity
 * Represents a Minecraft player who has (or is currently) connected to a
 * server, aggregated from usercache/playerdata/ops/whitelist/bans (#528).
 */
export class Player {
  private readonly _uuid: string;
  private readonly _name: string;
  private readonly _lastSeen: Date | null;
  private readonly _isOp: boolean;
  private readonly _isBanned: boolean;
  private readonly _isWhitelisted: boolean;
  private readonly _online: boolean;

  private constructor(data: PlayerProps) {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Name is required');
    }

    this._uuid = data.uuid;
    this._name = data.name;
    this._lastSeen = data.lastSeen;
    this._isOp = data.isOp;
    this._isBanned = data.isBanned;
    this._isWhitelisted = data.isWhitelisted;
    this._online = data.online;
  }

  get uuid(): string {
    return this._uuid;
  }

  get name(): string {
    return this._name;
  }

  get lastSeen(): Date | null {
    return this._lastSeen;
  }

  get isOp(): boolean {
    return this._isOp;
  }

  get isBanned(): boolean {
    return this._isBanned;
  }

  get isWhitelisted(): boolean {
    return this._isWhitelisted;
  }

  get online(): boolean {
    return this._online;
  }

  /**
   * Create a new Player entity
   */
  static create(data: PlayerProps): Player {
    return new Player(data);
  }

  toJSON(): PlayerJson {
    return {
      uuid: this._uuid,
      name: this._name,
      lastSeen: this._lastSeen ? this._lastSeen.toISOString() : null,
      isOp: this._isOp,
      isBanned: this._isBanned,
      isWhitelisted: this._isWhitelisted,
      online: this._online,
    };
  }
}
