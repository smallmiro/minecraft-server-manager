/**
 * Creeper ASCII art banner for mcctl CLI
 * Displays on init and version commands
 */

import { colors } from '@minecraft-docker/shared';

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  updateCommand: string;
}

// 8x8 Creeper face pattern using emoji blocks
export const CREEPER_ART: string[][] = [
  ['🟩', '🟩', '🟩', '🟩', '🟩', '🟩', '🟩', '🟩'],
  ['🟩', '⬛', '⬛', '🟩', '🟩', '⬛', '⬛', '🟩'],
  ['🟩', '⬛', '⬛', '🟩', '🟩', '⬛', '⬛', '🟩'],
  ['🟩', '🟩', '🟩', '⬛', '⬛', '🟩', '🟩', '🟩'],
  ['🟩', '🟩', '⬛', '⬛', '⬛', '⬛', '🟩', '🟩'],
  ['🟩', '🟩', '⬛', '⬛', '⬛', '⬛', '🟩', '🟩'],
  ['🟩', '🟩', '⬛', '🟩', '🟩', '⬛', '🟩', '🟩'],
  ['🟩', '🟩', '🟩', '🟩', '🟩', '🟩', '🟩', '🟩'],
];

// ASCII fallback for terminals without emoji support
export const CREEPER_ASCII: string[][] = [
  ['#', '#', '#', '#', '#', '#', '#', '#'],
  ['#', '@', '@', '#', '#', '@', '@', '#'],
  ['#', '@', '@', '#', '#', '@', '@', '#'],
  ['#', '#', '#', '@', '@', '#', '#', '#'],
  ['#', '#', '@', '@', '@', '@', '#', '#'],
  ['#', '#', '@', '@', '@', '@', '#', '#'],
  ['#', '#', '@', '#', '#', '@', '#', '#'],
  ['#', '#', '#', '#', '#', '#', '#', '#'],
];

export interface BannerOptions {
  version: string;
  gitHash?: string;
  updateInfo?: UpdateCheckResult | null;
  useAscii?: boolean;
}

/**
 * Generate the banner string with creeper art and version info
 */
export function generateBanner(options: BannerOptions): string {
  const { version, gitHash, updateInfo, useAscii = false } = options;
  const art = useAscii ? CREEPER_ASCII : CREEPER_ART;

  // Build right-side info lines
  const versionStr = gitHash ? `v${version} (${gitHash})` : `v${version}`;
  const infoLines = [
    '',
    `⛏️  mcctl ${versionStr}`,
    '─────────────────────────────',
    'Docker Minecraft Server',
    'Controller CLI',
    '',
    'https://minecraft-server-manager.readthedocs.io',
    '',
  ];

  // Build banner lines
  const lines: string[] = [];

  for (let i = 0; i < art.length; i++) {
    const artRow = art[i]!.join('');
    const infoLine = infoLines[i] || '';
    lines.push(`${artRow}   ${infoLine}`);
  }

  // Add empty line
  lines.push('');

  // Add update notification if available
  if (updateInfo) {
    lines.push(
      colors.yellow(`⚠️  Update available: ${updateInfo.currentVersion} → ${updateInfo.latestVersion}`)
    );
    lines.push(colors.dim(`    Run: ${updateInfo.updateCommand}`));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Print the banner to console
 */
export function printBanner(options: BannerOptions): void {
  console.log('');
  console.log(generateBanner(options));
}

/**
 * Get git commit hash (short)
 */
export function getGitHash(): string | undefined {
  try {
    const { execSync } = require('node:child_process');
    const hash = execSync('git rev-parse --short HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return hash || undefined;
  } catch {
    return undefined;
  }
}
