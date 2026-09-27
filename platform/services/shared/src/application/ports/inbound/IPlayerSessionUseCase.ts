import type { PlayerSession } from '../../../domain/entities/PlayerSession.js';

/** A player's session timeline plus derived visit stats (#528, Phase 4). */
export interface SessionHistory {
  visitCount: number;
  totalPlaytimeSeconds: number;
  lastSeen: Date | null;
  /** Newest first, limited to the requested count. */
  recent: PlayerSession[];
}

/**
 * Player Session Use Case - Inbound Port
 *
 * Ingests join/leave events from server logs into session history, and
 * serves the derived timeline/stats (#528, Phase 4).
 */
export interface IPlayerSessionUseCase {
  /**
   * Parse `lines` (as from `docker logs --timestamps`) and apply any
   * join/leave events found, in line order. Events at or before the
   * server's persisted cursor are skipped (dedupes re-reading overlapping
   * log ranges). Advances the cursor to the latest timestamp seen across
   * the whole batch — even lines with no join/leave event — so an idle
   * server still moves the cursor forward instead of re-fetching its full
   * lookback window on every tick.
   */
  ingestLogLines(serverName: string, lines: string[]): Promise<void>;

  /** Close every open session on a server, e.g. when the server process stops. */
  markServerStopped(serverName: string, at: Date): Promise<void>;

  /** Timestamp of the last log line ingested for a server, or null if never. */
  getCursor(serverName: string): Promise<Date | null>;

  /** A player's visit stats plus their most recent sessions (newest first). */
  getSessionHistory(
    serverName: string,
    playerName: string,
    now: Date,
    limit?: number
  ): Promise<SessionHistory>;
}
