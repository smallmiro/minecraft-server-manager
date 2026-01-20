import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

/**
 * Player entry in Minecraft JSON files (whitelist.json, ops.json, etc.)
 */
export interface PlayerEntry {
  uuid: string;
  name: string;
}

/**
 * Banned player entry
 */
export interface BannedPlayerEntry {
  uuid: string;
  name: string;
  created: string;
  source: string;
  expires: string;
  reason: string;
}

/**
 * Banned IP entry
 */
export interface BannedIpEntry {
  ip: string;
  created: string;
  source: string;
  expires: string;
  reason: string;
}

/**
 * Read player JSON file (whitelist.json, ops.json)
 */
export async function readPlayerJson(path: string): Promise<PlayerEntry[]> {
  if (!existsSync(path)) {
    return [];
  }

  try {
    const content = await readFile(path, 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Write player JSON file
 */
export async function writePlayerJson(path: string, entries: PlayerEntry[]): Promise<void> {
  const content = JSON.stringify(entries, null, 2);
  await writeFile(path, content, 'utf-8');
}

/**
 * Read banned players JSON file
 */
export async function readBannedPlayersJson(path: string): Promise<BannedPlayerEntry[]> {
  if (!existsSync(path)) {
    return [];
  }

  try {
    const content = await readFile(path, 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Write banned players JSON file
 */
export async function writeBannedPlayersJson(
  path: string,
  entries: BannedPlayerEntry[]
): Promise<void> {
  const content = JSON.stringify(entries, null, 2);
  await writeFile(path, content, 'utf-8');
}

/**
 * Read banned IPs JSON file
 */
export async function readBannedIpsJson(path: string): Promise<BannedIpEntry[]> {
  if (!existsSync(path)) {
    return [];
  }

  try {
    const content = await readFile(path, 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Write banned IPs JSON file
 */
export async function writeBannedIpsJson(path: string, entries: BannedIpEntry[]): Promise<void> {
  const content = JSON.stringify(entries, null, 2);
  await writeFile(path, content, 'utf-8');
}

/**
 * Find player by name in entries (case-insensitive)
 */
export function findPlayerByName(entries: PlayerEntry[], name: string): PlayerEntry | undefined {
  return entries.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
}

/**
 * Find banned player by name (case-insensitive)
 */
export function findBannedPlayerByName(
  entries: BannedPlayerEntry[],
  name: string
): BannedPlayerEntry | undefined {
  return entries.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
}

/**
 * Find banned IP
 */
export function findBannedIp(entries: BannedIpEntry[], ip: string): BannedIpEntry | undefined {
  return entries.find((entry) => entry.ip === ip);
}

/**
 * Create ISO timestamp string
 */
export function createTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', ' +0000');
}
