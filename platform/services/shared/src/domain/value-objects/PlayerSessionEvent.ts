/** A parsed join/leave event extracted from one server log line (#528, Phase 4). */
export interface PlayerSessionEvent {
  type: 'join' | 'leave';
  playerName: string;
  at: Date;
}

// `docker logs --timestamps` prefixes each line with an RFC3339Nano timestamp,
// e.g. `2026-09-27T08:13:49.123456789Z <original stdout line>`.
const DOCKER_TIMESTAMP_LINE = /^(\S+)\s+(.*)$/;

// Vanilla/Paper/Spigot all log the same "Server thread/INFO" message text for
// join/leave. Anchoring the whole message (not just a substring) and
// restricting the name to the Minecraft username charset rejects chat lines
// like `<Steve> Alex joined the game` (they start with `<`, which the
// username charset excludes).
const JOIN_LEAVE_MESSAGE =
  /^\[[^\]]*\]\s+\[Server thread\/INFO\]:\s+([A-Za-z0-9_]{1,16}) (joined|left) the game$/;

/**
 * Parse the RFC3339Nano timestamp `docker logs --timestamps` prefixes onto
 * every line (join/leave or not), or `null` when the line has no valid
 * timestamp prefix. Pure — no I/O.
 */
export function parseDockerLogTimestamp(line: string): Date | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const lineMatch = DOCKER_TIMESTAMP_LINE.exec(trimmed);
  if (!lineMatch) return null;

  const at = new Date(lineMatch[1]!);
  return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * Parse one `docker logs --timestamps` line into a join/leave event, or
 * `null` when the line isn't a player join/leave message. Pure — no I/O.
 */
export function parsePlayerSessionEvent(line: string): PlayerSessionEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const lineMatch = DOCKER_TIMESTAMP_LINE.exec(trimmed);
  if (!lineMatch) return null;
  const timestamp = lineMatch[1]!;
  const rest = lineMatch[2]!;

  const at = new Date(timestamp);
  if (Number.isNaN(at.getTime())) return null;

  const messageMatch = JOIN_LEAVE_MESSAGE.exec(rest.trim());
  if (!messageMatch) return null;
  const playerName = messageMatch[1]!;
  const verb = messageMatch[2]!;

  return { type: verb === 'joined' ? 'join' : 'leave', playerName, at };
}
