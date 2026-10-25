import type { ServerSpecDocument } from './ServerSpecDocument.js';
import { McVersion } from '../value-objects/McVersion.js';

/**
 * The image for the newest Minecraft: LATEST, no VERSION, or a version
 * McVersion cannot read. The bundled template's (a test keeps them equal).
 */
export const DEFAULT_SERVER_IMAGE = 'itzg/minecraft-server:java25';

/**
 * The image of a new server, by the Java its VERSION needs (#826), as
 * mcctl update picks it. No VERSION (a modpack decides) and snapshots or
 * pre-releases (24w14a, 1.20.5-rc1) get the newest Java.
 */
function imageFor(version: string | undefined): string {
  try {
    return `itzg/minecraft-server:${McVersion.create(version ?? 'LATEST').recommendedImageTag}`;
  } catch {
    return DEFAULT_SERVER_IMAGE;
  }
}

/** What a create request decides (CLI flags, API body, interactive answers), already validated. */
export interface CreateSpecInput {
  name: string;
  type: string;
  /** Absent: a modpack type lets the modpack decide; other types get LATEST. */
  version?: string;
  memory: string;
  seed?: string;
  worldUrl?: string;
  /** An existing world under worlds/ (else the server's own world `<name>`). */
  worldName?: string;
  /** Modpack slug, for MODRINTH (MODRINTH_*) and AUTO_CURSEFORGE (CF_*). */
  modpackSlug?: string;
  modpackVersion?: string;
  modLoader?: string;
  modpackExcludeFiles?: string[];
  enableWhitelist?: boolean;
  whitelistPlayers?: string[];
  playitDomain?: string;
}

const MODPACK_KEYS: Record<string, { slug: string; version: string; loader: string; exclude: string }> = {
  MODRINTH: { slug: 'MODRINTH_MODPACK', version: 'MODRINTH_VERSION', loader: 'MODRINTH_LOADER', exclude: 'MODRINTH_EXCLUDE_FILES' },
  AUTO_CURSEFORGE: { slug: 'CF_SLUG', version: 'CF_VERSION', loader: 'CF_LOADER', exclude: 'CF_EXCLUDE_MODS' },
};

/**
 * The ServerSpecDocument of a new server (ADR-0003 §5, create-server.sh
 * parity). Pure. The repository adds the bundled template's other
 * config.env keys on create (`write(doc, { create: true })`).
 */
export function buildCreateSpec(input: CreateSpecInput): ServerSpecDocument {
  const modpack = MODPACK_KEYS[input.type];
  const env: Record<string, string> = { MOTD: `Welcome to ${input.name}! Your adventure begins here.` };
  if (input.seed) env['SEED'] = input.seed;
  if (input.worldUrl) env['WORLD'] = input.worldUrl;
  if (modpack && input.modpackSlug) {
    env[modpack.slug] = input.modpackSlug;
    if (input.modpackVersion) env[modpack.version] = input.modpackVersion;
    if (input.modLoader) env[modpack.loader] = input.modLoader;
    if (input.modpackExcludeFiles?.length) env[modpack.exclude] = input.modpackExcludeFiles.join(',');
  }
  if (input.enableWhitelist) {
    env['ENABLE_WHITELIST'] = 'TRUE';
    if (input.whitelistPlayers?.length) env['WHITELIST'] = input.whitelistPlayers.join(',');
  }
  const version = input.version ?? (modpack ? undefined : 'LATEST');
  return {
    specVersion: 1,
    name: input.name,
    type: input.type,
    ...(version !== undefined && { version }),
    memory: input.memory,
    image: imageFor(version),
    world: { level: input.worldName ?? input.name, storage: 'universe' },
    routing: {
      customHostnames: [],
      ...(input.playitDomain && { playitDomain: input.playitDomain }),
      autoScale: { up: true, down: true },
    },
    env,
  };
}
