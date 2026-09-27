import type { PlayerSession } from '../../../domain/entities/PlayerSession.js';

/** Aggregated visit stats for one player, derived from their session rows. */
export interface PlayerSessionSummary {
  visitCount: number;
  totalPlaytimeSeconds: number;
  /** Latest session activity (open session counts as `now`); null when the player has no sessions. */
  lastSeen: Date | null;
}

/**
 * Player Session Repository Port - Outbound Port
 *
 * Persists join/leave session history parsed from server logs (#528, Phase
 * 4). Minecraft's own files don't retain a history, so this is the only
 * source of visit counts / cumulative playtime / session timelines. Player
 * names are matched case-insensitively throughout.
 */
export interface IPlayerSessionRepository {
  /**
   * Record a join. Closes any dangling open session for that player first
   * (defensive — a missed leave event shouldn't leak an open session
   * forever), then inserts a new open session starting at `at`.
   */
  recordJoin(serverName: string, playerName: string, at: Date): Promise<void>;

  /** Close that player's open session at `at`. No-op if none is open. */
  recordLeave(serverName: string, playerName: string, at: Date): Promise<void>;

  /** Close every open session on a server (e.g. on server stop) at `at`. */
  closeOpenSessions(serverName: string, at: Date): Promise<void>;

  /** A player's sessions, newest (`joinedAt`) first. */
  listSessions(serverName: string, playerName: string, limit?: number): Promise<PlayerSession[]>;

  /** Aggregate visit stats for a player; an open session counts up to `now`. */
  getSummary(serverName: string, playerName: string, now: Date): Promise<PlayerSessionSummary>;

  /** Timestamp of the last log line ingested for a server, or null if never. */
  getCursor(serverName: string): Promise<Date | null>;

  /** Advance the ingestion cursor for a server. */
  setCursor(serverName: string, at: Date): Promise<void>;
}
