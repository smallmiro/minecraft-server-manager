/**
 * mc-router log line parsing (#769).
 *
 * mc-router 1.47.x logs through logrus' default TextFormatter (logfmt), e.g.
 *   time="…" level=info msg="Connecting to backend" backendHostPort="mc-a:25565" player=Steve/<uuid> server=a.local
 * Only info-level messages are relied on; see the #769 research comment for the
 * full list. Anything this module does not recognise passes through as `info`.
 */

export type RouterLogKind = 'connect' | 'wake' | 'error' | 'info';

export interface RouterLogEvent {
  /** logrus `time` field; absent when the line is not logfmt. */
  ts?: string;
  kind: RouterLogKind;
  /** Hostname the client asked for (handshake server address). */
  hostname?: string;
  /** Backend host:port mc-router routed to. */
  target?: string;
  /** Player name; only present on login connections, not status pings. */
  player?: string;
  raw: string;
}

const WAKE_MESSAGES = new Set(['Scaling up backend server', 'Woke up backend server']);
const ERROR_LEVELS = new Set(['warning', 'error', 'fatal', 'panic']);

/** Parses `key=value key="quoted value"` pairs; returns null when no pair is found. */
function parseLogfmt(line: string): Map<string, string> | null {
  const fields = new Map<string, string>();
  const pattern = /([A-Za-z_][\w.-]*)=("((?:[^"\\]|\\.)*)"|\S*)/g;
  for (const match of line.matchAll(pattern)) {
    const [, key, bare, quoted] = match;
    fields.set(key!, quoted !== undefined ? unquote(quoted) : bare!);
  }
  return fields.size > 0 ? fields : null;
}

// logrus quotes with Go's %q; the escapes that matter for log text are these.
function unquote(value: string): string {
  return value.replace(/\\(["\\nt])/g, (_, ch: string) => (ch === 'n' ? '\n' : ch === 't' ? '\t' : ch));
}

/** `PlayerInfo.String()` is `<name>/<uuid>`; empty for status pings. */
function playerName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const slash = value.lastIndexOf('/');
  const name = slash >= 0 ? value.slice(0, slash) : value;
  return name || undefined;
}

export function parseRouterLogLine(line: string): RouterLogEvent {
  const raw = line.replace(/\r$/, '');
  const fields = parseLogfmt(raw);
  const msg = fields?.get('msg');
  if (!fields || msg === undefined) return { kind: 'info', raw };

  const ts = fields.get('time');
  const hostname = fields.get('server') || fields.get('serverAddress') || undefined;
  const target = fields.get('backendHostPort') || fields.get('backend') || undefined;
  const player = playerName(fields.get('player'));
  const level = fields.get('level');

  let kind: RouterLogKind = 'info';
  if (level && ERROR_LEVELS.has(level)) kind = 'error';
  else if (msg === 'Connecting to backend') kind = 'connect';
  else if (WAKE_MESSAGES.has(msg)) kind = 'wake';

  if (kind === 'info') return { ...(ts && { ts }), kind, raw };
  return {
    ...(ts && { ts }),
    kind,
    ...(hostname && { hostname }),
    ...(target && { target }),
    ...(player && { player }),
    raw,
  };
}
