/**
 * Mojang API Client
 * Provides player lookup functionality via Mojang API
 */

import { createHash } from 'node:crypto';

export interface MojangProfile {
  id: string;      // UUID without dashes
  name: string;    // Current username
}

export interface PlayerInfo {
  name: string;
  uuid: string;           // UUID with dashes
  uuidNoDashes: string;   // UUID without dashes
  skinUrl?: string;
  isOnline?: boolean;
  server?: string;
  source: 'mojang' | 'offline' | 'cache';
}

/**
 * Mojang API client for player lookup
 */
export class MojangApiClient {
  private static readonly API_BASE = 'https://api.mojang.com';
  private static readonly SESSION_BASE = 'https://sessionserver.mojang.com';

  /**
   * Look up a player by username via Mojang API
   * Returns null if player not found
   */
  async lookupByUsername(username: string): Promise<PlayerInfo | null> {
    try {
      const response = await fetch(
        `${MojangApiClient.API_BASE}/users/profiles/minecraft/${encodeURIComponent(username)}`
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Mojang API error: ${response.status} ${response.statusText}`);
      }

      const profile = await response.json() as MojangProfile;
      const uuid = formatUuid(profile.id);

      return {
        name: profile.name,
        uuid,
        uuidNoDashes: profile.id,
        source: 'mojang',
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('fetch')) {
        throw new Error(`Failed to connect to Mojang API: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get detailed profile including skin URL
   * Requires UUID (with or without dashes)
   */
  async getProfile(uuid: string): Promise<PlayerInfo | null> {
    try {
      const uuidNoDashes = uuid.replace(/-/g, '');
      const response = await fetch(
        `${MojangApiClient.SESSION_BASE}/session/minecraft/profile/${uuidNoDashes}`
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Mojang Session API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as {
        id: string;
        name: string;
        properties?: Array<{ name: string; value: string }>;
      };
      const formattedUuid = formatUuid(data.id);

      // Extract skin URL from properties
      let skinUrl: string | undefined;
      if (data.properties) {
        const texturesProp = data.properties.find((p) => p.name === 'textures');
        if (texturesProp) {
          try {
            const textures = JSON.parse(Buffer.from(texturesProp.value, 'base64').toString('utf-8'));
            skinUrl = textures.textures?.SKIN?.url;
          } catch {
            // Ignore texture parsing errors
          }
        }
      }

      return {
        name: data.name,
        uuid: formattedUuid,
        uuidNoDashes: data.id,
        skinUrl,
        source: 'mojang',
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('fetch')) {
        throw new Error(`Failed to connect to Mojang Session API: ${error.message}`);
      }
      throw error;
    }
  }
}

/**
 * Format UUID with dashes
 * Input: 8667ba71b85a4004af54457a9734eed7
 * Output: 8667ba71-b85a-4004-af54-457a9734eed7
 */
export function formatUuid(uuid: string): string {
  const clean = uuid.replace(/-/g, '');
  if (clean.length !== 32) {
    return uuid; // Return as-is if not a valid UUID
  }
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
}

/**
 * Calculate offline UUID from username
 * Offline servers use a different UUID format based on "OfflinePlayer:" + username
 */
export function calculateOfflineUuid(username: string): string {
  const hash = createHash('md5').update(`OfflinePlayer:${username}`).digest();

  // Set version to 3 (name-based MD5)
  const byte6 = hash[6];
  const byte8 = hash[8];
  if (byte6 !== undefined && byte8 !== undefined) {
    hash[6] = (byte6 & 0x0f) | 0x30;
    // Set variant to RFC 4122
    hash[8] = (byte8 & 0x3f) | 0x80;
  }

  const hex = hash.toString('hex');
  return formatUuid(hex);
}

/**
 * Get player info for offline mode
 */
export function getOfflinePlayerInfo(username: string): PlayerInfo {
  const uuid = calculateOfflineUuid(username);
  return {
    name: username,
    uuid,
    uuidNoDashes: uuid.replace(/-/g, ''),
    source: 'offline',
  };
}

// Singleton instance
let mojangApiClient: MojangApiClient | null = null;

export function getMojangApiClient(): MojangApiClient {
  if (!mojangApiClient) {
    mojangApiClient = new MojangApiClient();
  }
  return mojangApiClient;
}
