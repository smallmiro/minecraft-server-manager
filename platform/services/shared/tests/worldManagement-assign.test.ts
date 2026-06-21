/**
 * Regression tests for WorldManagementUseCase.assignWorldByName (#489).
 *
 * Assigning a world to a server must keep the server's LEVEL in sync with the
 * lock, so lockedBy and servers[] (derived from LEVEL) do not diverge.
 */
import { describe, test, expect, vi } from 'vitest';
import { WorldManagementUseCase } from '../src/application/use-cases/WorldManagementUseCase.js';
import type {
  IPromptPort,
  IShellPort,
  IWorldRepository,
  IServerRepository,
} from '../src/application/ports/index.js';

function makeUseCase(overrides: {
  worldAssign?: ReturnType<typeof vi.fn>;
  setServerConfig?: ReturnType<typeof vi.fn>;
  worldRelease?: ReturnType<typeof vi.fn>;
  isLocked?: boolean;
  worldExists?: boolean;
  serverExists?: boolean;
  previousLevel?: string; // the server's current LEVEL before reassigning
  previousLock?: { serverName: string } | null; // lock on the previous world
}) {
  const worldAssign =
    overrides.worldAssign ?? vi.fn().mockResolvedValue({ success: true });
  const setServerConfig =
    overrides.setServerConfig ?? vi.fn().mockResolvedValue({ success: true });
  const worldRelease =
    overrides.worldRelease ?? vi.fn().mockResolvedValue({ success: true });

  const shell = { worldAssign, setServerConfig, worldRelease } as unknown as IShellPort;
  const worldRepo = {
    findByName: vi.fn().mockResolvedValue(
      overrides.worldExists === false
        ? null
        : { name: 'new-world', isLocked: overrides.isLocked ?? false, lockedBy: undefined }
    ),
    getLockStatus: vi
      .fn()
      .mockResolvedValue(overrides.previousLock === undefined ? null : overrides.previousLock),
  } as unknown as IWorldRepository;
  const serverRepo = {
    exists: vi.fn().mockResolvedValue(overrides.serverExists ?? true),
    getConfig: vi
      .fn()
      .mockResolvedValue(
        overrides.previousLevel
          ? { customEnv: { LEVEL: overrides.previousLevel } }
          : { customEnv: {} }
      ),
  } as unknown as IServerRepository;
  const prompt = {} as IPromptPort;

  const useCase = new WorldManagementUseCase(prompt, shell, worldRepo, serverRepo);
  return { useCase, worldAssign, setServerConfig, worldRelease };
}

describe('WorldManagementUseCase.assignWorldByName - LEVEL sync (#489)', () => {
  test('sets the server LEVEL to the assigned world after locking', async () => {
    const { useCase, worldAssign, setServerConfig } = makeUseCase({});

    const result = await useCase.assignWorldByName('new-world', 'srv');

    expect(result.success).toBe(true);
    expect(worldAssign).toHaveBeenCalledWith('new-world', 'srv');
    expect(setServerConfig).toHaveBeenCalledWith('srv', 'LEVEL', 'new-world');
  });

  test('does not touch LEVEL when locking fails', async () => {
    const worldAssign = vi.fn().mockResolvedValue({ success: false, stderr: 'lock failed' });
    const { useCase, setServerConfig } = makeUseCase({ worldAssign });

    const result = await useCase.assignWorldByName('new-world', 'srv');

    expect(result.success).toBe(false);
    expect(result.error).toBe('lock failed');
    expect(setServerConfig).not.toHaveBeenCalled();
  });

  test('fails when LEVEL update fails (so callers see the inconsistency)', async () => {
    const setServerConfig = vi
      .fn()
      .mockResolvedValue({ success: false, stderr: 'config write failed' });
    const { useCase } = makeUseCase({ setServerConfig });

    const result = await useCase.assignWorldByName('new-world', 'srv');

    expect(result.success).toBe(false);
    expect(result.error).toBe('config write failed');
  });

  test('rejects assigning a locked world (no LEVEL change)', async () => {
    const { useCase, worldAssign, setServerConfig } = makeUseCase({ isLocked: true });

    const result = await useCase.assignWorldByName('new-world', 'srv');

    expect(result.success).toBe(false);
    expect(worldAssign).not.toHaveBeenCalled();
    expect(setServerConfig).not.toHaveBeenCalled();
  });
});

describe('WorldManagementUseCase.assignWorldByName - superseded lock release (#489 follow-up)', () => {
  test('releases the previous world lock when this server held it', async () => {
    const { useCase, worldRelease } = makeUseCase({
      previousLevel: 'old-world',
      previousLock: { serverName: 'srv' },
    });

    const result = await useCase.assignWorldByName('new-world', 'srv');

    expect(result.success).toBe(true);
    expect(worldRelease).toHaveBeenCalledWith('old-world');
  });

  test('does not release a previous world locked by another server', async () => {
    const { useCase, worldRelease } = makeUseCase({
      previousLevel: 'old-world',
      previousLock: { serverName: 'other-srv' },
    });

    const result = await useCase.assignWorldByName('new-world', 'srv');

    expect(result.success).toBe(true);
    expect(worldRelease).not.toHaveBeenCalled();
  });

  test('does not release when reassigning the same world', async () => {
    const { useCase, worldRelease } = makeUseCase({
      previousLevel: 'new-world',
      previousLock: { serverName: 'srv' },
    });

    await useCase.assignWorldByName('new-world', 'srv');

    expect(worldRelease).not.toHaveBeenCalled();
  });

  test('does not release when the server has no previous LEVEL', async () => {
    const { useCase, worldRelease } = makeUseCase({});

    await useCase.assignWorldByName('new-world', 'srv');

    expect(worldRelease).not.toHaveBeenCalled();
  });

  test('assignment still succeeds even if releasing the old lock throws', async () => {
    const worldRelease = vi.fn().mockRejectedValue(new Error('release boom'));
    const { useCase } = makeUseCase({
      worldRelease,
      previousLevel: 'old-world',
      previousLock: { serverName: 'srv' },
    });

    const result = await useCase.assignWorldByName('new-world', 'srv');

    expect(result.success).toBe(true);
  });
});
