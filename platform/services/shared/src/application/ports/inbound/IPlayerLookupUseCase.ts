/**
 * Player Lookup Use Case - Inbound Port
 * Looks up Minecraft player information
 */
export interface IPlayerLookupUseCase {
  /**
   * Interactive player lookup
   */
  lookup(): Promise<PlayerLookupResult>;

  /**
   * Lookup player by name
   */
  lookupByName(name: string): Promise<PlayerLookupResult>;

  /**
   * Get player UUID
   */
  getUuid(name: string, offline?: boolean): Promise<PlayerUuidResult>;
}

/**
 * Player lookup result
 */
export interface PlayerLookupResult {
  success: boolean;
  name?: string;
  uuid?: string;
  skinUrl?: string;
  nameHistory?: PlayerNameHistory[];
  error?: string;
}

/**
 * Player name history entry
 */
export interface PlayerNameHistory {
  name: string;
  changedAt?: Date;
}

/**
 * Player UUID result
 */
export interface PlayerUuidResult {
  success: boolean;
  name: string;
  uuid?: string;
  isOffline: boolean;
  error?: string;
}
