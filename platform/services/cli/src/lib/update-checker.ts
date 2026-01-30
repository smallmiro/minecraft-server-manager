import { homedir } from 'os';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { colors } from '@minecraft-docker/shared';

const PACKAGE_NAME = '@minecraft-docker/mcctl';
const CACHE_FILE = join(homedir(), '.mcctl-update-check.json');
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 2000; // 2 seconds

interface CacheData {
  lastCheck: number;
  latestVersion: string;
}

interface PackageJson {
  version: string;
}

/**
 * Get the current installed version from package.json
 */
function getCurrentVersion(): string {
  try {
    // Read from the package.json in the dist directory's parent
    const packageJsonPath = new URL('../../package.json', import.meta.url);
    const packageJson: PackageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version;
  } catch {
    return '0.0.0';
  }
}

/**
 * Read cache file
 */
function readCache(): CacheData | null {
  try {
    if (!existsSync(CACHE_FILE)) {
      return null;
    }
    const data = readFileSync(CACHE_FILE, 'utf-8');
    return JSON.parse(data) as CacheData;
  } catch {
    return null;
  }
}

/**
 * Write cache file
 */
function writeCache(data: CacheData): void {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch {
    // Ignore write errors
  }
}

/**
 * Fetch latest version from npm registry
 */
async function fetchLatestVersion(): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://registry.npmjs.org/${PACKAGE_NAME}/latest`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as { version: string };
    return data.version;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Compare two semantic versions
 * Returns true if version2 is newer than version1
 */
function isNewerVersion(currentVersion: string, latestVersion: string): boolean {
  const parseVersion = (v: string): number[] => {
    return v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  };

  const current = parseVersion(currentVersion);
  const latest = parseVersion(latestVersion);

  for (let i = 0; i < Math.max(current.length, latest.length); i++) {
    const c = current[i] ?? 0;
    const l = latest[i] ?? 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

/**
 * Print update notification box
 */
function printUpdateNotification(currentVersion: string, latestVersion: string): void {
  const message1 = `Update available: ${currentVersion} → ${latestVersion}`;
  const message2 = `Run: npm i -g ${PACKAGE_NAME}`;
  const maxLen = Math.max(message1.length, message2.length);
  const padding = 2;
  const boxWidth = maxLen + padding * 2;

  const topBorder = '┌' + '─'.repeat(boxWidth) + '┐';
  const bottomBorder = '└' + '─'.repeat(boxWidth) + '┘';
  const emptyLine = '│' + ' '.repeat(boxWidth) + '│';

  const padLine = (text: string): string => {
    const leftPad = ' '.repeat(padding);
    const rightPad = ' '.repeat(boxWidth - text.length - padding);
    return '│' + leftPad + text + rightPad + '│';
  };

  console.log('');
  console.log(colors.yellow(topBorder));
  console.log(colors.yellow(emptyLine));
  console.log(colors.yellow(padLine(message1)));
  console.log(colors.yellow(padLine(message2)));
  console.log(colors.yellow(emptyLine));
  console.log(colors.yellow(bottomBorder));
  console.log('');
}

/**
 * Check for updates and print notification if available
 */
export async function checkForUpdates(): Promise<void> {
  try {
    const currentVersion = getCurrentVersion();
    const cache = readCache();
    const now = Date.now();

    // Check if cache is valid (within 24 hours)
    if (cache && (now - cache.lastCheck) < CACHE_DURATION_MS) {
      // Use cached version
      if (isNewerVersion(currentVersion, cache.latestVersion)) {
        printUpdateNotification(currentVersion, cache.latestVersion);
      }
      return;
    }

    // Fetch latest version from npm
    const latestVersion = await fetchLatestVersion();

    if (latestVersion) {
      // Update cache
      writeCache({
        lastCheck: now,
        latestVersion,
      });

      // Check if update is available
      if (isNewerVersion(currentVersion, latestVersion)) {
        printUpdateNotification(currentVersion, latestVersion);
      }
    }
  } catch {
    // Silently ignore any errors - don't disrupt the user
  }
}
