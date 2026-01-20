/**
 * Player Cache System
 * Encrypted local cache for Mojang API responses to minimize rate limiting
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash, pbkdf2Sync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir, hostname, platform, userInfo } from 'node:os';
import {
  getMojangApiClient,
  getOfflinePlayerInfo,
  type PlayerInfo,
} from './mojang-api.js';

const CACHE_VERSION = 1;
const CACHE_FILENAME = '.player-cache';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

// Cache duration constants (in milliseconds)
const CACHE_DURATION = {
  UUID: Infinity,           // UUID never changes
  USERNAME: 30 * 24 * 60 * 60 * 1000,  // 30 days (name changes allowed)
  SKIN: 24 * 60 * 60 * 1000,           // 1 day (changes frequently)
};

interface CachedPlayer {
  name: string;
  uuid: string;
  uuidNoDashes: string;
  skinUrl?: string;
  source: 'mojang' | 'offline';
  cachedAt: number;
  nameUpdatedAt: number;
  skinUpdatedAt?: number;
}

interface CacheData {
  version: number;
  players: Record<string, CachedPlayer>;  // Keyed by lowercase username
}

interface EncryptedData {
  iv: string;      // Base64 encoded
  tag: string;     // Base64 encoded
  data: string;    // Base64 encoded
  salt: string;    // Base64 encoded
}

/**
 * Player cache with AES-256-GCM encryption
 */
export class PlayerCache {
  private readonly cachePath: string;
  private cache: CacheData | null = null;
  private encryptionKey: Buffer | null = null;

  constructor(cacheDir?: string) {
    const baseDir = cacheDir ?? join(homedir(), '.mcctl');
    this.cachePath = join(baseDir, CACHE_FILENAME);
  }

  /**
   * Look up a player by username
   * First checks cache, then Mojang API
   */
  async lookup(username: string, options: { forceRefresh?: boolean; offline?: boolean } = {}): Promise<PlayerInfo | null> {
    // Offline mode uses calculated UUID
    if (options.offline) {
      return getOfflinePlayerInfo(username);
    }

    const lowerUsername = username.toLowerCase();

    // Check cache first (unless force refresh)
    if (!options.forceRefresh) {
      const cached = await this.getFromCache(lowerUsername);
      if (cached) {
        return {
          name: cached.name,
          uuid: cached.uuid,
          uuidNoDashes: cached.uuidNoDashes,
          skinUrl: cached.skinUrl,
          source: 'cache',
        };
      }
    }

    // Fetch from Mojang API
    const client = getMojangApiClient();
    const info = await client.lookupByUsername(username);

    if (info) {
      // Save to cache
      await this.saveToCache(info);
    }

    return info;
  }

  /**
   * Look up a player with full profile (including skin URL)
   */
  async lookupWithProfile(username: string, options: { forceRefresh?: boolean } = {}): Promise<PlayerInfo | null> {
    const basic = await this.lookup(username, options);
    if (!basic) {
      return null;
    }

    // Check if we need to fetch skin URL
    const lowerUsername = username.toLowerCase();
    const cached = await this.getFromCache(lowerUsername);

    // Check if skin cache is still valid
    const skinValid = cached?.skinUpdatedAt &&
      (Date.now() - cached.skinUpdatedAt) < CACHE_DURATION.SKIN;

    if (!options.forceRefresh && skinValid && cached?.skinUrl) {
      return {
        ...basic,
        skinUrl: cached.skinUrl,
      };
    }

    // Fetch full profile from Mojang
    const client = getMojangApiClient();
    const profile = await client.getProfile(basic.uuid);

    if (profile?.skinUrl) {
      // Update cache with skin URL
      await this.updateSkinInCache(lowerUsername, profile.skinUrl);
      return {
        ...basic,
        skinUrl: profile.skinUrl,
      };
    }

    return basic;
  }

  /**
   * Get player from cache if valid
   */
  private async getFromCache(lowerUsername: string): Promise<CachedPlayer | null> {
    await this.loadCache();
    if (!this.cache) {
      return null;
    }

    const cached = this.cache.players[lowerUsername];
    if (!cached) {
      return null;
    }

    // Check if name cache is still valid
    const nameAge = Date.now() - cached.nameUpdatedAt;
    if (nameAge > CACHE_DURATION.USERNAME) {
      // Name cache expired, but UUID is still valid
      // Return null to trigger API call, but UUID will be updated in place
      return null;
    }

    return cached;
  }

  /**
   * Save player info to cache
   */
  private async saveToCache(info: PlayerInfo): Promise<void> {
    await this.loadCache();
    if (!this.cache) {
      this.cache = { version: CACHE_VERSION, players: {} };
    }

    const lowerUsername = info.name.toLowerCase();
    const now = Date.now();

    this.cache.players[lowerUsername] = {
      name: info.name,
      uuid: info.uuid,
      uuidNoDashes: info.uuidNoDashes,
      skinUrl: info.skinUrl,
      source: info.source === 'cache' ? 'mojang' : info.source,
      cachedAt: now,
      nameUpdatedAt: now,
      skinUpdatedAt: info.skinUrl ? now : undefined,
    };

    await this.persistCache();
  }

  /**
   * Update skin URL in cache
   */
  private async updateSkinInCache(lowerUsername: string, skinUrl: string): Promise<void> {
    await this.loadCache();
    if (!this.cache || !this.cache.players[lowerUsername]) {
      return;
    }

    this.cache.players[lowerUsername].skinUrl = skinUrl;
    this.cache.players[lowerUsername].skinUpdatedAt = Date.now();

    await this.persistCache();
  }

  /**
   * Load cache from encrypted file
   */
  private async loadCache(): Promise<void> {
    if (this.cache !== null) {
      return; // Already loaded
    }

    if (!existsSync(this.cachePath)) {
      this.cache = { version: CACHE_VERSION, players: {} };
      return;
    }

    try {
      const encrypted = JSON.parse(readFileSync(this.cachePath, 'utf-8')) as EncryptedData;
      const decrypted = await this.decrypt(encrypted);
      this.cache = JSON.parse(decrypted) as CacheData;

      // Migrate old cache versions if needed
      if (this.cache.version !== CACHE_VERSION) {
        this.cache = { version: CACHE_VERSION, players: {} };
      }
    } catch {
      // If decryption fails, start fresh
      this.cache = { version: CACHE_VERSION, players: {} };
    }
  }

  /**
   * Persist cache to encrypted file
   */
  private async persistCache(): Promise<void> {
    if (!this.cache) {
      return;
    }

    // Ensure directory exists
    const dir = dirname(this.cachePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    const data = JSON.stringify(this.cache);
    const encrypted = await this.encrypt(data);

    writeFileSync(this.cachePath, JSON.stringify(encrypted), { mode: 0o600 });

    // Ensure file permissions are correct (owner read/write only)
    try {
      chmodSync(this.cachePath, 0o600);
    } catch {
      // Ignore permission errors on some systems
    }
  }

  /**
   * Get or derive encryption key
   */
  private getEncryptionKey(salt: Buffer): Buffer {
    if (this.encryptionKey) {
      return this.encryptionKey;
    }

    // Derive key from machine-specific identifiers
    const machineId = this.getMachineIdentifier();
    this.encryptionKey = pbkdf2Sync(machineId, salt, 100000, 32, 'sha256');
    return this.encryptionKey;
  }

  /**
   * Get machine-specific identifier for key derivation
   */
  private getMachineIdentifier(): string {
    // Combine multiple machine-specific values
    const parts = [
      hostname(),
      platform(),
      userInfo().username,
      homedir(),
      // Add more entropy from environment
      process.env.USER || process.env.USERNAME || '',
    ];

    // Hash for consistent length
    return createHash('sha256').update(parts.join('|')).digest('hex');
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  private async encrypt(data: string): Promise<EncryptedData> {
    const salt = randomBytes(16);
    const key = this.getEncryptionKey(salt);
    const iv = randomBytes(12);

    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf-8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return {
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: encrypted.toString('base64'),
      salt: salt.toString('base64'),
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  private async decrypt(encrypted: EncryptedData): Promise<string> {
    const salt = Buffer.from(encrypted.salt, 'base64');
    const key = this.getEncryptionKey(salt);
    const iv = Buffer.from(encrypted.iv, 'base64');
    const tag = Buffer.from(encrypted.tag, 'base64');
    const data = Buffer.from(encrypted.data, 'base64');

    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]);

    return decrypted.toString('utf-8');
  }

  /**
   * Clear all cached data
   */
  async clear(): Promise<void> {
    this.cache = { version: CACHE_VERSION, players: {} };
    await this.persistCache();
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    playerCount: number;
    oldestEntry: number | null;
    newestEntry: number | null;
    cacheSize: number;
  }> {
    await this.loadCache();

    const players = Object.values(this.cache?.players ?? {});
    const timestamps = players.map(p => p.cachedAt);

    let cacheSize = 0;
    try {
      if (existsSync(this.cachePath)) {
        cacheSize = statSync(this.cachePath).size;
      }
    } catch {
      // Ignore stat errors
    }

    return {
      playerCount: players.length,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : null,
      cacheSize,
    };
  }
}

// Singleton instance
let playerCache: PlayerCache | null = null;

export function getPlayerCache(cacheDir?: string): PlayerCache {
  if (!playerCache) {
    playerCache = new PlayerCache(cacheDir);
  }
  return playerCache;
}
