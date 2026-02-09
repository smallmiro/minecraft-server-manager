import { describe, it, expect, vi, beforeEach } from 'vitest';
import { selectOpLevel } from '../../../src/lib/prompts/level-select.js';
import * as p from '@clack/prompts';
import { OpLevel } from '@minecraft-docker/shared';

vi.mock('@clack/prompts');

describe('selectOpLevel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return selected level', async () => {
    vi.mocked(p.select).mockResolvedValue(2);
    vi.mocked(p.isCancel).mockReturnValue(false);

    const result = await selectOpLevel();

    expect(result).toEqual(OpLevel.GAMEMASTER);
    expect(p.select).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Select OP Level:',
        initialValue: OpLevel.OWNER.value,
      })
    );
  });

  it('should use custom message', async () => {
    vi.mocked(p.select).mockResolvedValue(3);
    vi.mocked(p.isCancel).mockReturnValue(false);

    const result = await selectOpLevel({ message: 'Choose level:' });

    expect(result).toEqual(OpLevel.ADMIN);
    expect(p.select).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Choose level:',
      })
    );
  });

  it('should use custom initial level', async () => {
    vi.mocked(p.select).mockResolvedValue(1);
    vi.mocked(p.isCancel).mockReturnValue(false);

    const result = await selectOpLevel({ initialLevel: OpLevel.MODERATOR });

    expect(result).toEqual(OpLevel.MODERATOR);
    expect(p.select).toHaveBeenCalledWith(
      expect.objectContaining({
        initialValue: OpLevel.MODERATOR.value,
      })
    );
  });

  it('should return null on cancellation', async () => {
    vi.mocked(p.select).mockResolvedValue(Symbol('cancel') as any);
    vi.mocked(p.isCancel).mockReturnValue(true);

    const result = await selectOpLevel();

    expect(result).toBeNull();
  });

  it('should display all 4 levels with descriptions', async () => {
    vi.mocked(p.select).mockResolvedValue(4);
    vi.mocked(p.isCancel).mockReturnValue(false);

    await selectOpLevel();

    expect(p.select).toHaveBeenCalledWith(
      expect.objectContaining({
        options: [
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
        ],
      })
    );
  });

  it('should handle level 1 selection', async () => {
    vi.mocked(p.select).mockResolvedValue(1);
    vi.mocked(p.isCancel).mockReturnValue(false);

    const result = await selectOpLevel();

    expect(result?.value).toBe(1);
    expect(result?.label).toBe('Moderator');
  });

  it('should handle level 4 selection', async () => {
    vi.mocked(p.select).mockResolvedValue(4);
    vi.mocked(p.isCancel).mockReturnValue(false);

    const result = await selectOpLevel();

    expect(result?.value).toBe(4);
    expect(result?.label).toBe('Owner');
  });
});
