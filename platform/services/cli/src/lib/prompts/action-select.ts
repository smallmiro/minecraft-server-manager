/**
 * Action selection prompt component
 * Reusable prompt for selecting player management actions
 */

import { select, isCancel } from '@clack/prompts';
import { colors } from '@minecraft-docker/shared';

export type PlayerAction =
  | 'info'
  | 'whitelist-add'
  | 'whitelist-remove'
  | 'op-add'
  | 'op-remove'
  | 'ban'
  | 'unban'
  | 'kick'
  | 'back'
  | 'exit';

export interface ActionSelectOptions {
  message?: string;
  playerName: string;
  isOnline: boolean;
  isWhitelisted?: boolean;
  isOperator?: boolean;
  isBanned?: boolean;
}

interface ActionOption {
  value: PlayerAction;
  label: string;
  hint?: string;
  enabled: (options: ActionSelectOptions) => boolean;
}

const ACTIONS: ActionOption[] = [
  {
    value: 'info',
    label: 'View player info',
    hint: 'UUID, skin, status',
    enabled: () => true,
  },
  {
    value: 'whitelist-add',
    label: 'Add to whitelist',
    enabled: (opts) => !opts.isWhitelisted,
  },
  {
    value: 'whitelist-remove',
    label: 'Remove from whitelist',
    enabled: (opts) => opts.isWhitelisted === true,
  },
  {
    value: 'op-add',
    label: 'Add as operator',
    enabled: (opts) => !opts.isOperator,
  },
  {
    value: 'op-remove',
    label: 'Remove as operator',
    enabled: (opts) => opts.isOperator === true,
  },
  {
    value: 'ban',
    label: 'Ban player',
    enabled: (opts) => !opts.isBanned,
  },
  {
    value: 'unban',
    label: 'Unban player',
    enabled: (opts) => opts.isBanned === true,
  },
  {
    value: 'kick',
    label: 'Kick player',
    hint: 'online only',
    enabled: (opts) => opts.isOnline,
  },
];

const NAVIGATION: ActionOption[] = [
  {
    value: 'back',
    label: '← Back to player selection',
    enabled: () => true,
  },
  {
    value: 'exit',
    label: '✕ Exit',
    enabled: () => true,
  },
];

/**
 * Prompt user to select an action for a player
 * Returns the selected action or null if cancelled
 */
export async function selectAction(options: ActionSelectOptions): Promise<PlayerAction | null> {
  const { message = `Select action for ${options.playerName}:` } = options;

  // Filter enabled actions
  const enabledActions = ACTIONS.filter(action => action.enabled(options));

  // Build options list
  const selectOptions: Array<{ value: PlayerAction; label: string; hint?: string }> = [];

  for (const action of enabledActions) {
    selectOptions.push({
      value: action.value,
      label: action.label,
      hint: action.hint,
    });
  }

  // Add separator-like divider
  selectOptions.push({
    value: 'back',
    label: colors.dim('─────────────────'),
    hint: '',
  });

  // Add navigation options
  for (const nav of NAVIGATION) {
    selectOptions.push({
      value: nav.value,
      label: nav.label,
      hint: nav.hint,
    });
  }

  const selected = await select({
    message,
    options: selectOptions,
  });

  if (isCancel(selected)) {
    return null;
  }

  // Handle divider selection (treat as back)
  if ((selected as string).startsWith('─')) {
    return 'back';
  }

  return selected as PlayerAction;
}

/**
 * Prompt for continue or another action
 */
export async function promptContinue(playerName: string): Promise<'another' | 'back' | 'exit' | null> {
  const selected = await select({
    message: `Another action for ${playerName}?`,
    options: [
      { value: 'another', label: 'Yes, perform another action' },
      { value: 'back', label: '← Back to player selection' },
      { value: 'exit', label: '✕ Exit' },
    ],
  });

  if (isCancel(selected)) {
    return null;
  }

  return selected as 'another' | 'back' | 'exit';
}
