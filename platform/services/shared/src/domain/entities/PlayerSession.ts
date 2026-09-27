/**
 * PlayerSession entity data for creation
 */
export interface PlayerSessionProps {
  /** Row id once persisted; undefined for a session not yet saved. */
  id?: number;
  serverName: string;
  playerName: string;
  joinedAt: Date;
  /** null while the player is still connected. */
  leftAt: Date | null;
}

/**
 * Plain-serializable representation of a PlayerSession.
 */
export interface PlayerSessionJson {
  id?: number;
  serverName: string;
  playerName: string;
  joinedAt: string;
  leftAt: string | null;
}

/**
 * PlayerSession entity
 * A single join→leave connection window for a player on a server, derived
 * from parsed server log lines (#528, Phase 4). An open session (`leftAt ===
 * null`) counts as ongoing up to whatever `now` is passed to
 * `durationSeconds`.
 */
export class PlayerSession {
  private readonly _id?: number;
  private readonly _serverName: string;
  private readonly _playerName: string;
  private readonly _joinedAt: Date;
  private readonly _leftAt: Date | null;

  private constructor(data: PlayerSessionProps) {
    this._id = data.id;
    this._serverName = data.serverName;
    this._playerName = data.playerName;
    this._joinedAt = data.joinedAt;
    this._leftAt = data.leftAt;
  }

  get id(): number | undefined {
    return this._id;
  }

  get serverName(): string {
    return this._serverName;
  }

  get playerName(): string {
    return this._playerName;
  }

  get joinedAt(): Date {
    return this._joinedAt;
  }

  get leftAt(): Date | null {
    return this._leftAt;
  }

  /** Session length in seconds; an open session (`leftAt === null`) counts up to `now`. */
  durationSeconds(now: Date): number {
    const end = this._leftAt ?? now;
    return Math.max(0, Math.round((end.getTime() - this._joinedAt.getTime()) / 1000));
  }

  static create(data: PlayerSessionProps): PlayerSession {
    return new PlayerSession(data);
  }

  toJSON(): PlayerSessionJson {
    return {
      id: this._id,
      serverName: this._serverName,
      playerName: this._playerName,
      joinedAt: this._joinedAt.toISOString(),
      leftAt: this._leftAt ? this._leftAt.toISOString() : null,
    };
  }
}
