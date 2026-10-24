/**
 * promptSudoPasswordIfNeeded (#675): without a password the avahi registrar
 * tries `sudo -n` (NOPASSWD or cached credentials), so the prompt must not
 * say that Enter skips mDNS.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const clack = vi.hoisted(() => ({
  password: vi.fn(),
  isCancel: vi.fn(() => false),
  log: { info: vi.fn(), warn: vi.fn() },
}));
vi.mock('@clack/prompts', () => clack);
vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  existsSync: vi.fn(() => true), // avahi installed
}));

import { promptSudoPasswordIfNeeded } from '../../../src/lib/sudo-utils.js';

const said = () => [...clack.log.info.mock.calls, ...clack.log.warn.mock.calls].flat().join('\n');

describe('promptSudoPasswordIfNeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('MCCTL_SUDO_PASSWORD', '');
  });

  it('says that Enter tries sudo without a password, not that it skips mDNS', async () => {
    clack.password.mockResolvedValue('');
    expect(await promptSudoPasswordIfNeeded()).toBeUndefined();
    const message = clack.password.mock.calls[0]![0].message as string;
    expect(message).not.toMatch(/skip/i);
    expect(message).toMatch(/without a password/i);
    expect(said()).toMatch(/without a password/i);
    expect(said()).not.toMatch(/will not be registered/);
  });

  it('returns a typed password', async () => {
    clack.password.mockResolvedValue('s3cret');
    expect(await promptSudoPasswordIfNeeded()).toBe('s3cret');
  });
});
