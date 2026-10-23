import { describe, test, expect, vi } from 'vitest';

vi.mock('../src/docker/index.js', () => ({
  execScript: vi.fn(async () => ({ code: 0, stdout: '', stderr: '' })),
  execScriptInteractive: vi.fn(),
}));

import { execScript } from '../src/docker/index.js';
import { ShellAdapter } from '../src/infrastructure/adapters/ShellAdapter.js';
import { PlayerLookupUseCase } from '../src/application/use-cases/PlayerLookupUseCase.js';
import type { IPromptPort } from '../src/application/ports/index.js';

/** player.sh was removed (#730): the removal hint must reach the caller. */
describe('PlayerLookupUseCase with removed player.sh', () => {
  test('lookupByName passes the removal hint through instead of "Player not found"', async () => {
    const prompt = {
      spinner: () => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() }),
      warn: vi.fn(),
      error: vi.fn(),
      outro: vi.fn(),
      note: vi.fn(),
    } as unknown as IPromptPort;

    const result = await new PlayerLookupUseCase(prompt, new ShellAdapter()).lookupByName('Notch');

    expect(result.success).toBe(false);
    expect(result.error).toContain('player.sh was removed');
    expect(result.error).toContain('mcctl player info');
    expect(prompt.error).toHaveBeenCalledWith(expect.stringContaining('mcctl player info'));
    expect(execScript).not.toHaveBeenCalled();
  });
});
