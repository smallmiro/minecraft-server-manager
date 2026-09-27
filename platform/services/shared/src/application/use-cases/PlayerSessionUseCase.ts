import type {
  IPlayerSessionUseCase,
  SessionHistory,
} from '../ports/inbound/IPlayerSessionUseCase.js';
import type { IPlayerSessionRepository } from '../ports/outbound/IPlayerSessionRepository.js';
import { parsePlayerSessionEvent, parseDockerLogTimestamp } from '../../domain/index.js';

const DEFAULT_RECENT_LIMIT = 20;

/**
 * Player Session Use Case
 *
 * Parses server log lines into join/leave events and persists them via
 * `IPlayerSessionRepository`, deduping against the server's ingestion
 * cursor (#528, Phase 4).
 */
export class PlayerSessionUseCase implements IPlayerSessionUseCase {
  constructor(private readonly sessions: IPlayerSessionRepository) {}

  async ingestLogLines(serverName: string, lines: string[]): Promise<void> {
    const cursor = await this.sessions.getCursor(serverName);
    let latest: Date | null = null;

    for (const line of lines) {
      // Advance the cursor on every line's timestamp, not just matched
      // join/leave events — otherwise an idle server (no joins/leaves)
      // never moves the cursor and keeps re-fetching its full lookback
      // window on every tick.
      const at = parseDockerLogTimestamp(line);
      if (at && (!latest || at.getTime() > latest.getTime())) {
        latest = at;
      }

      const event = parsePlayerSessionEvent(line);
      if (!event) continue;
      if (cursor && event.at.getTime() <= cursor.getTime()) continue;

      if (event.type === 'join') {
        await this.sessions.recordJoin(serverName, event.playerName, event.at);
      } else {
        await this.sessions.recordLeave(serverName, event.playerName, event.at);
      }
    }

    if (latest && (!cursor || latest.getTime() > cursor.getTime())) {
      await this.sessions.setCursor(serverName, latest);
    }
  }

  async markServerStopped(serverName: string, at: Date): Promise<void> {
    await this.sessions.closeOpenSessions(serverName, at);
  }

  async getCursor(serverName: string): Promise<Date | null> {
    return this.sessions.getCursor(serverName);
  }

  async getSessionHistory(
    serverName: string,
    playerName: string,
    now: Date,
    limit: number = DEFAULT_RECENT_LIMIT
  ): Promise<SessionHistory> {
    const summary = await this.sessions.getSummary(serverName, playerName, now);
    const recent = await this.sessions.listSessions(serverName, playerName, limit);
    return { ...summary, recent };
  }
}
