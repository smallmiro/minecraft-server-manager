/**
 * create-server.sh was removed in #675 (ADR-0003 §5). The v2 signatures stay
 * (#736): the shell path fails with a clear message instead of ENOENT.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/docker/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/docker/index.js')>()),
  execScript: vi.fn(async () => ({ code: 0, stdout: '', stderr: '' })),
}));

import { execScript } from '../src/docker/index.js';
import { ShellAdapter } from '../src/infrastructure/adapters/ShellAdapter.js';
import { CreateServerUseCase } from '../src/application/use-cases/CreateServerUseCase.js';
import { ServerName, ServerType, McVersion, WorldOptions } from '../src/domain/index.js';
import type { IPromptPort, IServerRepository, IWorldAssignmentPort } from '../src/application/ports/index.js';

const REMOVED = /create-server\.sh was removed in #675; pass specRepo \/ use ServerSpec provision/;

describe('create-server.sh removed (#675)', () => {
  it('ShellAdapter.createServer rejects with the removal message and runs nothing', async () => {
    await expect(
      new ShellAdapter().createServer(ServerName.create('alpha'), {
        type: ServerType.create('PAPER'),
        version: McVersion.create('1.21.1'),
        worldOptions: WorldOptions.default(),
      })
    ).rejects.toThrow(REMOVED);
    expect(execScript).not.toHaveBeenCalled();
  });

  it('CreateServerUseCase without provisioning deps rejects with the removal message', async () => {
    const assignments = {
      snapshot: async () => ({ assignments: [], undetermined: [] }),
    } as unknown as IWorldAssignmentPort;
    const audit = { log: vi.fn(async () => undefined) };
    const useCase = new CreateServerUseCase(
      {} as IPromptPort,
      new ShellAdapter(),
      { exists: async () => false } as unknown as IServerRepository,
      undefined,
      undefined,
      audit as never,
      undefined,
      assignments
    );
    await expect(useCase.executeWithConfig({ name: 'alpha', version: '1.21.1' })).rejects.toThrow(REMOVED);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ status: 'failure' }));
    expect(execScript).not.toHaveBeenCalled();
  });
});
