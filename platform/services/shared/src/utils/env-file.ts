/**
 * Format-preserving `.env` helpers.
 *
 * The platform `.env` is read by docker compose, dotenv and bash
 * (`backup.sh` runs `set -a; source .env`), so every value we write must be
 * literal in all three. Untouched lines are kept byte-identical.
 */
import { createHash, randomUUID } from 'node:crypto';
import { open, realpath, rename, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

/** Valid env key name (POSIX shell variable name). */
export const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * No line break or other control character: a `KEY=value` line in an env
 * file stays one line (#720).
 */
export const SINGLE_LINE_RE = /^[^\x00-\x1f\x7f]*$/;

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

function decodeValue(rest: string): string {
  const v = rest.trim();
  const quote = v[0];
  if (quote === '"' || quote === "'") {
    const end = v.indexOf(quote, 1);
    if (end > 0) return v.slice(1, end);
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
 * Apply set/remove changes to `.env` content. `set` rewrites every occurrence
 * of a key and appends missing keys at the end; `remove` drops every
 * occurrence. All other lines stay byte-identical.
 */
export function applyEnvChanges(content: string, changes: EnvChanges): string {
  const set = new Map(Object.entries(changes.set ?? {}));
  const remove = new Set(changes.remove ?? []);
  for (const key of [...set.keys(), ...remove]) {
    if (!ENV_KEY_RE.test(key)) throw new Error(`Invalid key name: ${JSON.stringify(key)}`);
    if (set.has(key) && remove.has(key)) throw new Error(`Key ${key} is both set and removed`);
  }
  const replacements = new Map([...set].map(([key, value]) => [key, `${key}=${serializeEnvValue(value)}`]));

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

/**
 * Atomically replace `path`: write a temp file in the same directory, fsync,
 * set `mode`, then rename over the target. A symlink is resolved first so the
 * link itself is kept. On failure the original file is left untouched.
 */
export async function writeFileAtomic(path: string, content: string | Uint8Array, mode = 0o600): Promise<void> {
  let target = path;
  try {
    target = await realpath(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  const tmp = join(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`);
  const file = await open(tmp, 'wx', mode);
  try {
    try {
      await file.writeFile(content);
      await file.chmod(mode);
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(tmp, target);
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
}
