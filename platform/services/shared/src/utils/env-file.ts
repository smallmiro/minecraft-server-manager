/**
 * The env codec: the one parse / serialize / validate rule for every env file
 * TS reads or writes (platform `.env`, `servers/<name>/config.env`) (#656).
 *
 * The platform `.env` is read by docker compose, dotenv and bash (it is
 * `source`d; `mcctl.sh` did until #734), so every value we write must be
 * literal in all three. Untouched lines are kept byte-identical.
 *
 * Parsing (parseEnvDocument) follows Docker Compose's env_file reader, the
 * consumer that matters:
 * - Blank lines and lines whose first non-blank character is `#` are skipped.
 *   Lines that are not `KEY=value` are skipped too.
 * - `export ` before the key is allowed; whitespace around the key and `=` is
 *   ignored. The key is a POSIX name (ENV_KEY_RE).
 * - Unquoted value: runs to end of line, trimmed; ` #` (whitespace + hash)
 *   starts an inline comment. `a#b` is kept.
 * - Single-quoted value: literal up to the next `'`.
 * - Double-quoted value: up to the next unescaped `"`; `\n`, `\r`, `\t`, `\"`,
 *   `\\` and `\$` are unescaped, any other backslash is kept.
 * - Text after a closing quote is ignored. An unterminated quote is read
 *   literally (Compose rejects the file).
 * - The last occurrence of a duplicate key wins.
 * - Not supported: `${VAR}` interpolation and quoted values that span lines
 *   (Compose supports both; no file we write uses them).
 *
 * Serializing (applyEnvChanges) has two styles. Untouched lines stay
 * byte-identical in both:
 * - quoted (default, platform `.env`, also `source`d by bash): bare when
 *   bare-safe, otherwise single-quoted (serializeEnvValue).
 * - raw (`config.env`): `KEY=value` unquoted when that reads back as the same
 *   value. A value raw cannot carry (` #`, leading/trailing blanks, a leading
 *   quote) is single-quoted; one that cannot be quoted either (contains `'`)
 *   or has a control character throws EnvValueError. Every written value
 *   reads back unchanged. Rejecting user input that starts with a quote
 *   (#726) is the caller's job (assertEnvFileValue), not the serializer's.
 */
import { createHash } from 'node:crypto';

/** Valid env key name (POSIX shell variable name). */
export const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * A value Compose reads back from `KEY=<value>` in an env_file as exactly
 * that one setting (#720, #726):
 * - no control character (C0, DEL, C1) or U+2028/U+2029 line separator;
 * - first non-blank character is not a quote or backtick. Compose closes a
 *   quoted value and parses the rest of the line as more settings
 *   (MOTD="" MODS=<url>), while an unquoted value runs to the end of line.
 */
export const ENV_FILE_VALUE_RE = /^(?!\s*["'`])[^\x00-\x1f\x7f-\x9f\u2028\u2029]*$/;

/** A value that cannot be written as one `KEY=value` setting. */
export class EnvValueError extends Error {
  constructor(key: string) {
    super(`${key} must be one line without control characters and must not start with a quote`);
    this.name = 'EnvValueError';
  }
}

/**
 * Throw EnvValueError unless `value` matches ENV_FILE_VALUE_RE. A server's
 * config.env is an env_file with no escape syntax that the readers share,
 * so reject rather than escape (#726).
 */
export function assertEnvFileValue(key: string, value: string): void {
  if (!ENV_FILE_VALUE_RE.test(value)) throw new EnvValueError(key);
}

/** Values matching this are literal in bash, compose and dotenv without quotes. */
const BARE_SAFE_RE = /^[A-Za-z0-9_./:,@%+=-]*$/;

const ENTRY_RE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/;

export interface EnvLine {
  /** Original line text, without the `\n` separator. */
  raw: string;
  /** Set when the line is a `KEY=value` entry. */
  key?: string;
}

export interface EnvDocument {
  lines: EnvLine[];
  /** Effective values; the last occurrence of a duplicate key wins (dotenv/bash/compose). */
  values: Map<string, string>;
}

export interface EnvChanges {
  set?: Record<string, string>;
  remove?: string[];
}

export interface ApplyEnvOptions {
  /** Server config.env style: unquoted when possible (see the module header). */
  raw?: boolean;
}

const DOUBLE_QUOTE_ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\', $: '$' };

function decodeValue(rest: string): string {
  const v = rest.trim();
  if (v[0] === "'") {
    const end = v.indexOf("'", 1);
    if (end > 0) return v.slice(1, end);
  } else if (v[0] === '"') {
    const match = /^"((?:[^"\\]|\\.)*)"/.exec(v);
    if (match) return match[1]!.replace(/\\(.)/g, (seq, ch: string) => DOUBLE_QUOTE_ESCAPES[ch] ?? seq);
  }
  return v.replace(/\s+#.*$/, '');
}

export function parseEnvDocument(content: string): EnvDocument {
  const values = new Map<string, string>();
  const lines = content.split('\n').map((raw): EnvLine => {
    const match = ENTRY_RE.exec(raw.replace(/\r$/, ''));
    if (!match) return { raw };
    const key = match[1]!;
    values.set(key, decodeValue(match[2]!));
    return { raw, key };
  });
  return { lines, values };
}

const CONTROL_CHAR_RE = /[\x00-\x1f\x7f-\x9f\u2028\u2029]/;

/** Raw-style value for `KEY=<here>` in config.env (see the module header). */
function serializeRawEnvValue(key: string, value: string): string {
  if (CONTROL_CHAR_RE.test(value)) throw new EnvValueError(key);
  if (!/^["'`]/.test(value) && decodeValue(value) === value) return value;
  if (!value.includes("'")) return `'${value}'`;
  throw new EnvValueError(key);
}

/**
 * Serialize a value for `KEY=<here>`: bare when bare-safe, otherwise
 * single-quoted (literal in bash, compose v2 and dotenv). A single quote,
 * CR, LF or NUL cannot be represented safely and is rejected.
 */
export function serializeEnvValue(value: string): string {
  if (/['\r\n\0]/.test(value)) {
    throw new Error('Value must not contain a single quote, CR, LF or NUL');
  }
  return BARE_SAFE_RE.test(value) ? value : `'${value}'`;
}

/**
 * Apply set/remove changes to env file content. `set` rewrites every
 * occurrence of a key and appends missing keys at the end; `remove` drops
 * every occurrence. All other lines stay byte-identical. Values use the quoted
 * style unless `options.raw` (see the module header).
 */
export function applyEnvChanges(content: string, changes: EnvChanges, options: ApplyEnvOptions = {}): string {
  const set = new Map(Object.entries(changes.set ?? {}));
  const remove = new Set(changes.remove ?? []);
  for (const key of [...set.keys(), ...remove]) {
    if (!ENV_KEY_RE.test(key)) throw new Error(`Invalid key name: ${JSON.stringify(key)}`);
    if (set.has(key) && remove.has(key)) throw new Error(`Key ${key} is both set and removed`);
  }
  const serialize = (key: string, value: string): string =>
    options.raw ? serializeRawEnvValue(key, value) : serializeEnvValue(value);
  const replacements = new Map([...set].map(([key, value]) => [key, `${key}=${serialize(key, value)}`]));

  const trailingNewline = content.endsWith('\n');
  const lines = content === '' ? [] : parseEnvDocument(trailingNewline ? content.slice(0, -1) : content).lines;
  const out: string[] = [];
  const written = new Set<string>();
  for (const { raw, key } of lines) {
    if (key === undefined) {
      out.push(raw);
    } else if (remove.has(key)) {
      continue;
    } else {
      const replacement = replacements.get(key);
      if (replacement !== undefined) written.add(key);
      out.push(replacement ?? raw);
    }
  }
  const appended = [...replacements].filter(([key]) => !written.has(key)).map(([, line]) => line);
  out.push(...appended);

  if (out.length === 0) return '';
  return out.join('\n') + (trailingNewline || appended.length > 0 ? '\n' : '');
}

/** Revision token for optimistic concurrency: sha256 hex of the file bytes. */
export function envRevision(content: string | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}
