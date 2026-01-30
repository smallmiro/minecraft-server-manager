/**
 * Player selection prompt component
 * Reusable prompt for selecting a player from online players or manual entry
 */

import { select, text, isCancel } from '@clack/prompts';
import { colors, log } from '@minecraft-docker/shared';
import { getOnlinePlayers } from '../rcon.js';

export interface PlayerSelectOptions {
  message?: string;
  containerName: string;
  allowManualEntry?: boolean;
  includeOffline?: boolean;
}

export interface SelectedPlayer {
  name: string;
  isOnline: boolean;
  source: 'online' | 'manual';
}

const MANUAL_ENTRY_VALUE = '__manual__';

/**
 * Prompt user to select a player
 * Returns the selected player info or null if cancelled
 */
export async function selectPlayer(options: PlayerSelectOptions): Promise<SelectedPlayer | null> {
  const {
    containerName,
    message = 'Select player:',
    allowManualEntry = true,
    includeOffline = false,
  } = options;

  // Get online players
  let onlinePlayers: string[] = [];
  try {
    const result = await getOnlinePlayers(containerName);
    onlinePlayers = result.players;
  } catch {
    // Ignore errors, just show empty list
  }

  // Build options list
  const selectOptions: Array<{ value: string; label: string; hint?: string }> = [];

  // Add online players
  for (const player of onlinePlayers) {
    selectOptions.push({
      value: player,
      label: player,
      hint: colors.green('online'),
    });
  }

  // Add manual entry option if allowed
  if (allowManualEntry) {
    selectOptions.push({
      value: MANUAL_ENTRY_VALUE,
      label: 'Enter player name manually',
      hint: colors.dim('type a name'),
    });
  }

  // If no options available
  if (selectOptions.length === 0) {
    log.error('No players available and manual entry is disabled');
    return null;
  }

  // If only manual entry is available
  const firstOption = selectOptions[0];
  if (selectOptions.length === 1 && firstOption && firstOption.value === MANUAL_ENTRY_VALUE) {
    log.info('No players online, entering manual mode');
    const playerName = await promptManualPlayerName();
    if (!playerName) return null;
    return { name: playerName, isOnline: false, source: 'manual' };
  }

  const selected = await select({
    message,
    options: selectOptions,
  });

  if (isCancel(selected)) {
    return null;
  }

  // Handle manual entry
  if (selected === MANUAL_ENTRY_VALUE) {
    const playerName = await promptManualPlayerName();
    if (!playerName) return null;

    const isOnline = onlinePlayers.some(
      p => p.toLowerCase() === playerName.toLowerCase()
    );

    return { name: playerName, isOnline, source: 'manual' };
  }

  // Return selected online player
  return {
    name: selected as string,
    isOnline: true,
    source: 'online',
  };
}

/**
 * Prompt for manual player name entry
 */
async function promptManualPlayerName(): Promise<string | null> {
  const playerName = await text({
    message: 'Enter player name:',
    placeholder: 'Notch',
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Player name is required';
      }
      if (!/^[a-zA-Z0-9_]{3,16}$/.test(value.trim())) {
        return 'Invalid player name (3-16 characters, letters, numbers, underscore)';
      }
      return undefined;
    },
  });

  if (isCancel(playerName)) {
    return null;
  }

  return (playerName as string).trim();
}

/**
 * Simple text prompt for player name
 */
export async function promptPlayerName(message = 'Enter player name:'): Promise<string | null> {
  const playerName = await text({
    message,
    placeholder: 'Notch',
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Player name is required';
      }
      if (!/^[a-zA-Z0-9_]{3,16}$/.test(value.trim())) {
        return 'Invalid player name (3-16 characters, letters, numbers, underscore)';
      }
      return undefined;
    },
  });

  if (isCancel(playerName)) {
    return null;
  }

  return (playerName as string).trim();
}
