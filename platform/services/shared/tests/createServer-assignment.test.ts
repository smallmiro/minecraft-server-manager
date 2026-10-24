/**
 * CreateServerUseCase checks R1 for the world the new server will use
 * (--world, else its default world <name>) before provisioning (#670, #675).
 */
import { describe, test, expect, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CreateServerUseCase } from '../src/application/use-cases/CreateServerUseCase.js';
import { Paths } from '../src/utils/index.js';
import type {
  IPromptPort,
  IShellPort,
  IServerRepository,
  IWorldAssignmentPort,
  IServerSpecRepository,
} from '../src/application/ports/index.js';

function setup(levels: Record<string, string>, opts: { undetermined?: string[]; noPort?: boolean } = {}) {
  const port: IWorldAssignmentPort = {
    snapshot: vi.fn(async () => ({
      assignments: Object.entries(levels).map(([server, world]) => ({ server, world, internal: false })),
      undetermined: opts.undetermined ?? [],
    })),
    assign: vi.fn(),
    release: vi.fn(),
  };
  const shell = { createServer: vi.fn() };
  const specRepo = { write: vi.fn(async () => undefined) };
  const serverRepo = { exists: vi.fn().mockResolvedValue(false) };
  const useCase = new CreateServerUseCase(
    {} as IPromptPort,
    shell as unknown as IShellPort,
    serverRepo as unknown as IServerRepository,
    new Paths(mkdtempSync(join(tmpdir(), 'mcctl-create-'))),
    undefined,
    undefined,
    undefined,
    opts.noPort ? undefined : port,
    { specRepo: specRepo as unknown as IServerSpecRepository }
  );
  return { useCase, specRepo };
}

describe('CreateServerUseCase.executeWithConfig - world assignment (#670)', () => {
  test('creates a server whose default world is free', async () => {
    const { useCase, specRepo } = setup({ alpha: 'alpha' });
    await useCase.executeWithConfig({ name: 'beta', type: 'PAPER', version: '1.21.1', autoStart: false });
    expect(specRepo.write).toHaveBeenCalled();
  });

  test('attaches a free existing world', async () => {
    const { useCase, specRepo } = setup({ alpha: 'alpha' });
    await useCase.executeWithConfig({ name: 'beta', type: 'PAPER', version: '1.21.1', worldName: 'free', autoStart: false });
    expect(specRepo.write).toHaveBeenCalled();
  });

  test('refuses --world held by another server (R1, R6)', async () => {
    const { useCase, specRepo } = setup({ alpha: 'shared' });

    await expect(
      useCase.executeWithConfig({ name: 'beta', type: 'PAPER', version: '1.21.1', worldName: 'shared' })
    ).rejects.toMatchObject({ code: 'conflict', servers: ['alpha'] });
    expect(specRepo.write).not.toHaveBeenCalled();
  });

  test('refuses a default world <name> held by another server', async () => {
    const { useCase, specRepo } = setup({ alpha: 'beta' });

    await expect(useCase.executeWithConfig({ name: 'beta', type: 'PAPER', version: '1.21.1' })).rejects.toMatchObject({
      code: 'conflict',
    });
    expect(specRepo.write).not.toHaveBeenCalled();
  });

  test('refuses while any server is undetermined (R7)', async () => {
    const { useCase, specRepo } = setup({}, { undetermined: ['broken'] });

    await expect(useCase.executeWithConfig({ name: 'beta', type: 'PAPER', version: '1.21.1' })).rejects.toMatchObject({
      code: 'undetermined',
    });
    expect(specRepo.write).not.toHaveBeenCalled();
  });

  test('fails closed without an assignment port', async () => {
    const { useCase, specRepo } = setup({}, { noPort: true });

    await expect(useCase.executeWithConfig({ name: 'beta', type: 'PAPER', version: '1.21.1' })).rejects.toMatchObject({
      code: 'undetermined',
    });
    expect(specRepo.write).not.toHaveBeenCalled();
  });
});
