import { ServerName, EXISTING_SERVER_NAME_PATTERN } from '../value-objects/ServerName.js';
import { WORLD_NAME_PATTERN, EXISTING_WORLD_NAME_PATTERN } from '../value-objects/WorldName.js';
import { ServerType } from '../value-objects/ServerType.js';
import { Memory } from '../value-objects/Memory.js';
import { ENV_KEY_RE, ENV_FILE_VALUE_RE } from '../../utils/env-file.js';

/**
 * The server definition (#675, ADR-0003 §1). Pure: no I/O.
 *
 * `ServerSpec` is the v2 (D1) export and keeps its `{ name }` shape until
 * v3.0.0 (#715, #736); the full type is `ServerSpecDocument`.
 */
export interface ServerSpec {
  name: string;
}

export type WorldStorage = 'universe' | 'data';

export interface ServerSpecDocument extends ServerSpec {
  specVersion: 1;
  /** Directory name; the container is mc-<name>. */
  name: string;
  /** TYPE */
  type: string;
  /** VERSION; absent = itzg/modpack decides. */
  version?: string;
  /** MEMORY */
  memory?: string;
  /** Compose image, e.g. itzg/minecraft-server:java25 */
  image: string;
  world: {
    /** LEVEL (ADR-0002 resolveWorldName) */
    level: string;
    /** worlds/<level> (universe) or servers/<n>/data/<level> (data), ADR-0002 D-1 */
    storage: WorldStorage;
  };
  routing: {
    /** User-added mc-router hostnames. */
    customHostnames: string[];
    /** PLAYIT_DOMAIN and a router hostname. */
    playitDomain?: string;
    autoScale: { up: boolean; down: boolean };
    /** mc-router.auto-scale-asleep-motd */
    asleepMotd?: string;
    /** mc-router.auto-scale-loading-motd */
    loadingMotd?: string;
  };
  /** Every other config.env key, file order kept. */
  env: Record<string, string>;
}

export const SERVER_SPEC_VERSION = 1;

/** config.env keys the document holds as typed fields, so they may not appear in `env`. */
export const SERVER_SPEC_MANAGED_ENV_KEYS: Readonly<Record<string, string>> = {
  TYPE: 'type',
  VERSION: 'version',
  MEMORY: 'memory',
  LEVEL: 'world.level',
  PLAYIT_DOMAIN: 'routing.playitDomain',
};

export type ServerSpecErrorCode =
  | 'invalid_spec'
  | 'not_found'
  | 'already_exists'
  | 'conflict'
  | 'edit_conflict'
  | 'compose_edited'
  | 'undetermined'
  | 'storage_change'
  | 'locked'
  | 'unsupported_spec_version';

export interface ServerSpecIssue {
  /** Dotted path in server.yaml, e.g. `routing.autoScale.up`, `env.SEED`. */
  path: string;
  message: string;
}

/** Every ServerSpec failure: names the server, the file and the field, and the next step. */
export class ServerSpecError extends Error {
  constructor(
    readonly code: ServerSpecErrorCode,
    message: string,
    readonly server?: string,
    readonly issues: ServerSpecIssue[] = []
  ) {
    super(message);
    this.name = 'ServerSpecError';
  }
}

/** `create`: the strict rules for a new server. `existing`: what works today (imported servers). */
export type ServerSpecRules = 'create' | 'existing';

const DIMENSION_SUFFIX = /_(nether|the_end)$/;

/**
 * A Minecraft version a new server may ask for: releases, LATEST, snapshots
 * (24w14a) and pre-releases (1.20.5-rc1). The same rule as the API create
 * schema; itzg resolves the value.
 */
export const MC_VERSION_INPUT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * Hostname rule for mc-router hosts (RFC 1123, case-insensitive): why
 * `value` is invalid, or undefined.
 */
export function validateHostname(value: string): string | undefined {
  const host = value.toLowerCase();
  if (host.length === 0 || host.length > 253) return 'must be 1-253 characters';
  for (const label of host.split('.')) {
    if (label.length > 63) return `label '${label}' exceeds 63 characters`;
    if (!HOST_LABEL.test(label)) {
      return `label '${label}' must be letters, digits and inner hyphens (RFC 1123)`;
    }
  }
  return undefined;
}

const TOP_KEYS = ['specVersion', 'name', 'type', 'version', 'memory', 'image', 'world', 'routing', 'env'];
const WORLD_KEYS = ['level', 'storage'];
const ROUTING_KEYS = ['customHostnames', 'playitDomain', 'autoScale', 'asleepMotd', 'loadingMotd'];
const AUTO_SCALE_KEYS = ['up', 'down'];

const isMapping = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Error message of a value object factory, or undefined when it accepts the value. */
function rejects(create: (v: string) => unknown, value: string): string | undefined {
  try {
    create(value);
    return undefined;
  } catch (e) {
    return (e as Error).message;
  }
}

function envValueError(value: string): string | undefined {
  return ENV_FILE_VALUE_RE.test(value)
    ? undefined
    : 'must be one line without control characters and must not start with a quote';
}

/**
 * Every problem with `value` as a ServerSpecDocument, in document order.
 * An empty list means `value` is a valid document under `rules`.
 */
export function validateServerSpecDocument(value: unknown, rules: ServerSpecRules): ServerSpecIssue[] {
  const issues: ServerSpecIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  const create = rules === 'create';

  if (!isMapping(value)) {
    add('', 'must be a mapping of the server.yaml fields');
    return issues;
  }

  const unknownKeys = (obj: Record<string, unknown>, allowed: string[], prefix: string) => {
    for (const key of Object.keys(obj)) {
      if (!allowed.includes(key)) add(prefix + key, 'unknown key');
    }
  };

  /** A string field: undefined when absent or not a string (the issue is recorded). */
  const str = (obj: Record<string, unknown>, key: string, path: string, required: boolean): string | undefined => {
    const v = obj[key];
    if (v === undefined) {
      if (required) add(path, 'is required');
      return undefined;
    }
    if (typeof v !== 'string') {
      add(path, `must be a string; quote the value (YAML read ${JSON.stringify(v)} as a ${v === null ? 'null' : typeof v})`);
      return undefined;
    }
    return v;
  };

  const check = (path: string, error: string | undefined) => {
    if (error) add(path, error);
  };

  const mapping = (key: string, path: string): Record<string, unknown> | undefined => {
    const v = value[key];
    if (v === undefined) {
      add(path, 'is required');
      return undefined;
    }
    if (!isMapping(v)) {
      add(path, 'must be a mapping');
      return undefined;
    }
    return v;
  };

  if (value['specVersion'] === undefined) add('specVersion', 'is required');
  else if (value['specVersion'] !== SERVER_SPEC_VERSION) {
    add('specVersion', `unsupported version ${JSON.stringify(value['specVersion'])}; upgrade mcctl`);
  }

  const name = str(value, 'name', 'name', true);
  if (name !== undefined) {
    check(
      'name',
      create
        ? ServerName.validate(name)
        : EXISTING_SERVER_NAME_PATTERN.test(name) ? undefined : `invalid server name '${name}'`
    );
  }

  const type = str(value, 'type', 'type', true);
  if (type !== undefined) check('type', create ? rejects(ServerType.create, type) : envValueError(type));
  const version = str(value, 'version', 'version', false);
  if (version !== undefined) {
    check(
      'version',
      create
        ? MC_VERSION_INPUT_PATTERN.test(version) ? undefined : `invalid Minecraft version '${version}' (e.g. 1.21.1, LATEST, 24w14a)`
        : envValueError(version)
    );
  }
  const memory = str(value, 'memory', 'memory', false);
  if (memory !== undefined) check('memory', create ? rejects(Memory.create, memory) : envValueError(memory));

  const image = str(value, 'image', 'image', true);
  if (image !== undefined && !/^\S+$/.test(image)) add('image', 'must be a non-empty image reference without spaces');

  const world = mapping('world', 'world');
  if (world) {
    const level = str(world, 'level', 'world.level', true);
    if (level !== undefined) {
      if (create) {
        if (!WORLD_NAME_PATTERN.test(level) || DIMENSION_SUFFIX.test(level)) {
          add('world.level', 'only letters, numbers, hyphens and underscores, not ending in _nether or _the_end');
        }
      } else if (!EXISTING_WORLD_NAME_PATTERN.test(level)) {
        add('world.level', `'${level}' does not name one directory under worlds/`);
      }
    }
    const storage = str(world, 'storage', 'world.storage', true);
    if (storage !== undefined && storage !== 'universe' && storage !== 'data') {
      add('world.storage', "must be 'universe' or 'data'");
    }
    unknownKeys(world, WORLD_KEYS, 'world.');
  }

  const routing = mapping('routing', 'routing');
  if (routing) {
    const hosts = routing['customHostnames'];
    if (hosts === undefined) add('routing.customHostnames', 'is required (use [] for none)');
    else if (!Array.isArray(hosts)) add('routing.customHostnames', 'must be a list');
    else {
      hosts.forEach((h: unknown, i) => {
        const path = `routing.customHostnames[${i}]`;
        if (typeof h !== 'string') add(path, 'must be a string; quote the value');
        else check(path, validateHostname(h));
      });
    }
    const playit = str(routing, 'playitDomain', 'routing.playitDomain', false);
    if (playit !== undefined) check('routing.playitDomain', validateHostname(playit));

    const autoScale = routing['autoScale'];
    if (autoScale === undefined) add('routing.autoScale', 'is required');
    else if (!isMapping(autoScale)) add('routing.autoScale', 'must be a mapping with up and down');
    else {
      for (const key of AUTO_SCALE_KEYS) {
        if (typeof autoScale[key] !== 'boolean') add(`routing.autoScale.${key}`, 'must be true or false');
      }
      unknownKeys(autoScale, AUTO_SCALE_KEYS, 'routing.autoScale.');
    }
    str(routing, 'asleepMotd', 'routing.asleepMotd', false);
    str(routing, 'loadingMotd', 'routing.loadingMotd', false);
    unknownKeys(routing, ROUTING_KEYS, 'routing.');
  }

  const env = mapping('env', 'env');
  if (env) {
    for (const key of Object.keys(env)) {
      const path = `env.${key}`;
      if (!ENV_KEY_RE.test(key)) {
        add(path, 'is not a valid env key (letters, digits, underscore; not starting with a digit)');
        continue;
      }
      const field = SERVER_SPEC_MANAGED_ENV_KEYS[key];
      if (field) {
        add(path, `is managed by the spec; set ${field} instead`);
        continue;
      }
      const v = str(env, key, path, true);
      if (v === undefined) continue;
      check(path, envValueError(v));
      if (key === 'EXTRA_ARGS' && /(^|\s)--universe(\s|=|$)/.test(v)) {
        add(path, 'must not contain --universe; set world.storage instead');
      }
    }
  }

  unknownKeys(value, TOP_KEYS, '');
  return issues;
}

/**
 * `value` as a ServerSpecDocument, or a ServerSpecError: `unsupported_spec_version`
 * for a file from a newer mcctl, `invalid_spec` listing every issue otherwise.
 */
export function assertServerSpecDocument(
  value: unknown,
  rules: ServerSpecRules,
  where: { server: string; file: string }
): ServerSpecDocument {
  const version = isMapping(value) ? value['specVersion'] : undefined;
  if (typeof version === 'number' && version > SERVER_SPEC_VERSION) {
    throw new ServerSpecError(
      'unsupported_spec_version',
      `${where.file} has specVersion ${version}, newer than this mcctl supports (${SERVER_SPEC_VERSION}); upgrade mcctl`,
      where.server
    );
  }
  const issues = validateServerSpecDocument(value, rules);
  if (issues.length > 0) {
    const list = issues.map((i) => `  ${i.path || '(root)'}: ${i.message}`).join('\n');
    throw new ServerSpecError(
      'invalid_spec',
      `Invalid server spec for '${where.server}' (${where.file}):\n${list}`,
      where.server,
      issues
    );
  }
  return value as unknown as ServerSpecDocument;
}

/**
 * The mc-router hosts of a server (ADR-0003 §3): `<n>.local`, `<n>.<ip>.nip.io`
 * per host address, the playit domain, then the custom hosts; deduplicated
 * case-insensitively, first occurrence kept.
 */
export function routerHosts(doc: ServerSpecDocument, hostIps: string[]): string[] {
  const all = [
    `${doc.name}.local`,
    ...hostIps.map((ip) => `${doc.name}.${ip}.nip.io`),
    ...(doc.routing.playitDomain ? [doc.routing.playitDomain] : []),
    ...doc.routing.customHostnames,
  ];
  const seen = new Set<string>();
  return all.filter((h) => {
    const key = h.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
