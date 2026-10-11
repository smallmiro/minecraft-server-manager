import { describe, it, expect } from 'vitest';
import { toApiAuthEnv } from '../../../src/lib/api-auth-env.js';

describe('toApiAuthEnv', () => {
  it('maps internal to a loopback-only ip-whitelist', () => {
    const env = toApiAuthEnv('internal', null, []);
    expect(env.AUTH_MODE).toBe('ip-whitelist');
    expect(env.AUTH_IP_WHITELIST).toBe('127.0.0.1,::1,::ffff:127.0.0.1');
    expect(env.AUTH_API_KEY).toBeUndefined();
  });

  it('maps api-key-ip to combined with key and ips', () => {
    const env = toApiAuthEnv('api-key-ip', 'k', ['10.0.0.0/8']);
    expect(env).toEqual({ AUTH_MODE: 'combined', AUTH_API_KEY: 'k', AUTH_IP_WHITELIST: '10.0.0.0/8' });
  });

  it('maps open to disabled without credentials', () => {
    expect(toApiAuthEnv('open', null, [])).toEqual({ AUTH_MODE: 'disabled' });
  });

  it('passes api-key and ip-whitelist through', () => {
    expect(toApiAuthEnv('api-key', 'k', [])).toEqual({ AUTH_MODE: 'api-key', AUTH_API_KEY: 'k' });
    expect(toApiAuthEnv('ip-whitelist', null, ['1.2.3.4'])).toEqual({
      AUTH_MODE: 'ip-whitelist',
      AUTH_IP_WHITELIST: '1.2.3.4',
    });
  });
});
