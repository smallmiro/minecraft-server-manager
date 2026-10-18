import { describe, it, expect } from 'vitest';
import { childProcessEnv } from '../src/config/index.js';

describe('childProcessEnv (#685)', () => {
  it('drops keys loaded from .env so compose and scripts read the current file', () => {
    const env = { PATH: '/bin', MCCTL_ROOT: '/root', TZ: 'UTC', RCON_PASSWORD: 'old' };

    const child = childProcessEnv({ MCCTL_SCRIPTS: '/s' }, env, ['TZ', 'RCON_PASSWORD']);

    expect(child).toEqual({ PATH: '/bin', MCCTL_ROOT: '/root', MCCTL_SCRIPTS: '/s' });
    expect(env.TZ).toBe('UTC');
  });

  it('keeps extra values even for dropped keys', () => {
    expect(childProcessEnv({ TZ: 'Asia/Seoul' }, { TZ: 'UTC' }, ['TZ'])).toEqual({ TZ: 'Asia/Seoul' });
  });
});
