import * as p from '@clack/prompts';
import { OpLevel } from '@minecraft-docker/shared';

export interface SelectOpLevelOptions {
  message?: string;
  initialLevel?: OpLevel;
}

/**
 * Interactive prompt for selecting OP level (1-4)
 * Returns null if user cancels
 */
export async function selectOpLevel(
  options: SelectOpLevelOptions = {}
): Promise<OpLevel | null> {
  const { message = 'Select OP Level:', initialLevel = OpLevel.OWNER } = options;

  const levelOptions = [
    {
      value: 1,
      label: 'Level 1 - Moderator',
      hint: OpLevel.MODERATOR.description,
    },
    {
      value: 2,
      label: 'Level 2 - Gamemaster',
      hint: OpLevel.GAMEMASTER.description,
    },
    {
      value: 3,
      label: 'Level 3 - Admin',
      hint: OpLevel.ADMIN.description,
    },
    {
      value: 4,
      label: 'Level 4 - Owner',
      hint: OpLevel.OWNER.description,
    },
  ];

  const selectedLevel = await p.select({
    message,
    options: levelOptions,
    initialValue: initialLevel.value,
  });

  // Check for cancellation
  if (p.isCancel(selectedLevel)) {
    return null;
  }

  // Convert to OpLevel
  return OpLevel.from(selectedLevel as number);
}
