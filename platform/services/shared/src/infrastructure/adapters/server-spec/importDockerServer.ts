import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';
import type { Paths } from '../../../utils/index.js';
import { parseEnvDocument } from '../../../utils/env-file.js';
import { resolveWorldName } from '../../../domain/value-objects/WorldName.js';
import {
  ServerSpecError,
  validateServerSpecDocument,
  type ServerSpecDocument,
} from '../../../domain/server-spec/ServerSpecDocument.js';
import { isInterpolated, readInheritedExtraArgs } from '../effectiveExtraArgs.js';
import { universeLocation, withoutUniverse } from '../../../domain/server-spec/extraArgs.js';

export interface ImportContext {
  paths: Paths;
  /** Current host addresses; nip.io router hosts for other addresses are reported as stale. */
  hostIps: string[];
}

export type ServerSpecImport =
  | { server: string; status: 'imported'; document: ServerSpecDocument; warnings: string[] }
  | { server: string; status: 'refused'; reason: string; warnings: string[] };

class Refused extends Error {}

const ROUTER = {
  host: 'mc-router.host',
  up: 'mc-router.auto-scale-up',
  down: 'mc-router.auto-scale-down',
  asleep: 'mc-router.auto-scale-asleep-motd',
  loading: 'mc-router.auto-scale-loading-motd',
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Compose `labels`/`environment` in map or list (`KEY=value`) form as a map.
 * null = a bare key (Compose passes the shell's value through).
 */
export function composeMap(value: unknown): Map<string, string | null> {
  const out = new Map<string, string | null>();
  if (Array.isArray(value)) {
    for (const item of value) {
      const s = String(item);
      const i = s.indexOf('=');
      if (i < 0) out.set(s, null);
      else out.set(s.slice(0, i), s.slice(i + 1));
    }
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) out.set(k, v === null || v === undefined ? null : String(v));
  }
  return out;
}

async function readOptional(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw err;
  }
}

/**
 * Build the ServerSpecDocument of an existing Docker server from
 * servers/<n>/config.env and docker-compose.yml (ADR-0003 §4). Reads only.
 *
 * Refused (the server keeps running as is) when a managed value cannot be
 * determined: `${...}` interpolation, an unknown --universe location, an
 * unexpected compose layout, or a value the existing-server rules reject.
 */
export async function importDockerServer(name: string, ctx: ImportContext): Promise<ServerSpecImport> {
  const warnings: string[] = [];
  try {
    const document = await build(name, ctx, warnings);
    return { server: name, status: 'imported', document, warnings };
  } catch (err) {
    if (err instanceof Refused) return { server: name, status: 'refused', reason: err.message, warnings };
    throw err;
  }
}

const refuse = (reason: string): never => {
  throw new Refused(reason);
};

/** The parsed compose service mc-<name>: image and mc-router labels checked, environment as is. */
interface ComposePart {
  image: string;
  labels: Map<string, string | null>;
  environment: Map<string, string | null>;
}

/** Check and read servers/<n>/docker-compose.yml (ADR-0003 §4 step 4). */
function readCompose(name: string, composeText: string): ComposePart {
  let compose: unknown;
  try {
    compose = yaml.load(composeText);
  } catch (e) {
    refuse(`servers/${name}/docker-compose.yml does not parse: ${(e as Error).message.split('\n')[0]}`);
  }
  const services = (compose as { services?: unknown } | null)?.services;
  const service = `mc-${name}`;
  if (!services || typeof services !== 'object' || Object.keys(services).join() !== service) {
    refuse(`servers/${name}/docker-compose.yml must define exactly one service '${service}'`);
  }
  const svc = (services as Record<string, Record<string, unknown>>)[service] ?? {};

  const image = svc['image'];
  if (typeof image !== 'string' || image.trim() === '') refuse(`servers/${name}/docker-compose.yml has no image`);

  const labels = composeMap(svc['labels']);
  for (const [key, value] of labels) {
    if (key.startsWith('mc-router.')) labels.set(key, composeLiteralValue(name, `label ${key}`, value));
  }
  return {
    image: composeLiteralValue(name, 'image', image as string),
    labels,
    environment: composeMap(svc['environment']),
  };
}

/** A Compose value without interpolation: `$$` read as `$`; a lone `$` or a pass-through (null) is refused. */
function composeLiteralValue(name: string, what: string, value: string | null): string {
  if (value === null || value.replace(/\$\$/g, '').includes('$')) composeUndetermined(name, what);
  return value!.replace(/\$\$/g, '$');
}

function composeUndetermined(name: string, what: string): never {
  return refuse(
    `${what} in servers/${name}/docker-compose.yml uses \${...} or a shell pass-through; replace it with a literal value`
  );
}

/** The fields config.env (plus moved compose environment) defines. */
interface ConfigPart {
  type: string;
  version?: string;
  memory?: string;
  playitDomain?: string;
  world: ServerSpecDocument['world'];
  env: Record<string, string>;
}

/**
 * config.env to the typed fields and env (ADR-0003 §4 steps 1-3).
 * `environment`: compose entries that override config.env (already checked).
 */
async function readConfigEnv(
  name: string,
  configText: string,
  paths: Paths,
  warnings: string[],
  environment: Map<string, string> = new Map()
): Promise<ConfigPart> {
  const dir = join(paths.servers, name);
  const doc = parseEnvDocument(configText);
  const values = new Map(doc.values);
  const fromCompose = new Set<string>();
  for (const [key, value] of environment) {
    values.set(key, value);
    fromCompose.add(key);
  }

  const worldKey = values.get('LEVEL')?.trim() ? 'LEVEL' : 'WORLD_NAME';
  for (const key of ['TYPE', 'VERSION', 'MEMORY', 'PLAYIT_DOMAIN', worldKey, 'EXTRA_ARGS']) {
    if (!fromCompose.has(key) && isInterpolated(doc, key)) {
      refuse(`${key} in servers/${name}/config.env uses \${...} interpolation; replace it with a literal value`);
    }
  }

  const take = (key: string): string | undefined => {
    const value = values.get(key);
    values.delete(key);
    return value?.trim() ? value : undefined;
  };
  const level = resolveWorldName(Object.fromEntries(values));
  values.delete('LEVEL');
  let type = take('TYPE');
  if (type === undefined) {
    warnings.push('TYPE is not set; the spec uses VANILLA (the itzg default)');
    type = 'VANILLA';
  }
  const version = take('VERSION');
  const memory = take('MEMORY');
  const playitDomain = take('PLAYIT_DOMAIN');

  // --- world storage from the effective EXTRA_ARGS (ADR-0002) ---
  let extraArgs: string | undefined;
  if (values.has('EXTRA_ARGS')) {
    extraArgs = values.get('EXTRA_ARGS');
  } else {
    const inherited = await readInheritedExtraArgs(paths);
    if (inherited instanceof Error) {
      refuse('EXTRA_ARGS inherited from servers/global.env or .env cannot be read or uses ${...} interpolation');
    }
    extraArgs = inherited as string | undefined;
    warnings.push(
      `EXTRA_ARGS was inherited from servers/global.env (${extraArgs ? `'${extraArgs}'` : 'unset'}); ` +
        'the spec pins it for this server'
    );
  }
  const location = universeLocation(extraArgs ?? '');
  if (!location) {
    refuse(`EXTRA_ARGS '${extraArgs}' puts the world somewhere other than /worlds or /data; set --universe /worlds/ or remove it`);
  }
  const storage = location === 'worlds' ? 'universe' : 'data';
  const rest = withoutUniverse(extraArgs ?? '');
  if (rest) values.set('EXTRA_ARGS', rest);
  else values.delete('EXTRA_ARGS');
  if (storage === 'universe' && !existsSync(join(paths.worlds, level)) && existsSync(join(dir, 'data', level))) {
    warnings.push(`worlds/${level} does not exist but servers/${name}/data/${level} does; check the world before starting`);
  }

  return {
    type,
    ...(version !== undefined && { version }),
    ...(memory !== undefined && { memory }),
    ...(playitDomain !== undefined && { playitDomain }),
    world: { level, storage },
    env: Object.fromEntries(values),
  };
}

/** Router labels to the routing fields (system hosts dropped, custom hosts kept). */
function readRouting(
  name: string,
  labels: Map<string, string | null>,
  playitDomain: string | undefined,
  hostIps: string[],
  warnings: string[]
): ServerSpecDocument['routing'] {
  const nipIo = new RegExp(`^${escapeRe(name)}\\.(\\d{1,3}(?:\\.\\d{1,3}){3})\\.nip\\.io$`, 'i');
  const customHostnames: string[] = [];
  for (const raw of (labels.get(ROUTER.host) ?? '').split(',')) {
    const host = raw.trim().toLowerCase();
    if (!host || host === `${name}.local`.toLowerCase()) continue;
    if (playitDomain && host === playitDomain.toLowerCase()) continue;
    const ip = nipIo.exec(host)?.[1];
    if (ip) {
      if (hostIps.length > 0 && !hostIps.includes(ip)) {
        warnings.push(`router host ${host} uses ${ip}, which is not a current host address; nip.io hosts are re-derived from HOST_IPS`);
      }
      continue;
    }
    if (!customHostnames.includes(host)) customHostnames.push(host);
  }
  const flag = (key: string) => labels.get(key)?.trim().toLowerCase() === 'true';
  return {
    customHostnames,
    ...(playitDomain !== undefined && { playitDomain }),
    autoScale: { up: flag(ROUTER.up), down: flag(ROUTER.down) },
    ...(labels.get(ROUTER.asleep) != null && { asleepMotd: labels.get(ROUTER.asleep)! }),
    ...(labels.get(ROUTER.loading) != null && { loadingMotd: labels.get(ROUTER.loading)! }),
  };
}

/** Refuse a document the existing-server rules reject; report what only the create rules reject. */
function checked(document: ServerSpecDocument, warnings: string[]): ServerSpecDocument {
  const issues = validateServerSpecDocument(document, 'existing');
  if (issues.length > 0) {
    refuse(`cannot import: ${issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
  }
  for (const issue of validateServerSpecDocument(document, 'create')) {
    warnings.push(`${issue.path} would be rejected for a new server: ${issue.message}`);
  }
  return document;
}

async function build(name: string, { paths, hostIps }: ImportContext, warnings: string[]): Promise<ServerSpecDocument> {
  const dir = join(paths.servers, name);
  const configText = await readOptional(join(dir, 'config.env'));
  if (configText === undefined) refuse(`servers/${name}/config.env is missing`);
  const composeText = await readOptional(join(dir, 'docker-compose.yml'));
  if (composeText === undefined) refuse(`servers/${name}/docker-compose.yml is missing`);

  const compose = readCompose(name, composeText!);

  // Compose gives environment precedence over env_file: move it into env, report clashes.
  const configValues = parseEnvDocument(configText!).values;
  const environment = new Map<string, string>();
  for (const [key, raw] of compose.environment) {
    if (key === 'EULA') continue;
    const value = composeLiteralValue(name, `environment ${key}`, raw);
    const old = configValues.get(key);
    warnings.push(
      old === undefined
        ? `docker-compose.yml environment ${key} moved into the spec`
        : old === value
          ? `docker-compose.yml environment ${key} moved into the spec (same as config.env)`
          : `docker-compose.yml environment ${key}=${value} overrides config.env ${key}=${old}; the spec keeps ${value}`
    );
    environment.set(key, value);
  }

  const { playitDomain, ...config } = await readConfigEnv(name, configText!, paths, warnings, environment);
  return checked(
    {
      specVersion: 1,
      name,
      type: config.type,
      ...(config.version !== undefined && { version: config.version }),
      ...(config.memory !== undefined && { memory: config.memory }),
      image: compose.image,
      world: config.world,
      routing: readRouting(name, compose.labels, playitDomain, hostIps, warnings),
      env: config.env,
    },
    warnings
  );
}

function undeterminedError(name: string, err: unknown): unknown {
  return err instanceof Refused ? new ServerSpecError('undetermined', `Cannot read server '${name}': ${err.message}`, name) : err;
}

function existingOnly(document: ServerSpecDocument): ServerSpecDocument {
  const issues = validateServerSpecDocument(document, 'existing');
  if (issues.length > 0) refuse(`${issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
  return document;
}

/**
 * `doc` with a hand-edited config.env read back into it (ADR-0003 §3):
 * type, version, memory, world, playit domain and env come from the file.
 * Rejects ServerSpecError('undetermined') like a refused import.
 */
export async function absorbConfigEnv(
  doc: ServerSpecDocument,
  configText: string,
  paths: Paths,
  warnings: string[]
): Promise<ServerSpecDocument> {
  try {
    const { playitDomain, ...c } = await readConfigEnv(doc.name, configText, paths, warnings);
    const { playitDomain: _old, ...routing } = doc.routing;
    return existingOnly({
      specVersion: doc.specVersion,
      name: doc.name,
      type: c.type,
      ...(c.version !== undefined && { version: c.version }),
      ...(c.memory !== undefined && { memory: c.memory }),
      image: doc.image,
      world: c.world,
      routing: { ...routing, ...(playitDomain !== undefined && { playitDomain }) },
      env: c.env,
    });
  } catch (err) {
    throw undeterminedError(doc.name, err);
  }
}

/**
 * `doc` with the spec-owned fields of a hand-edited docker-compose.yml
 * (image, mc-router labels) read back into it (ADR-0003 §3). Environment
 * entries are not spec-owned here: they count as edits outside the spec.
 */
export function absorbCompose(
  doc: ServerSpecDocument,
  composeText: string,
  hostIps: string[],
  warnings: string[]
): ServerSpecDocument {
  try {
    const compose = readCompose(doc.name, composeText);
    return existingOnly({
      ...doc,
      image: compose.image,
      routing: readRouting(doc.name, compose.labels, doc.routing.playitDomain, hostIps, warnings),
    });
  } catch (err) {
    throw undeterminedError(doc.name, err);
  }
}
