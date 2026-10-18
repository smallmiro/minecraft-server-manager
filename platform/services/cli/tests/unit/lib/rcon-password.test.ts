import { describe, it, expect } from 'vitest';
import { generateRconPassword, randomizeRconPassword } from '../../../src/lib/rcon-password.js';

describe('generateRconPassword', () => {
  it('is at least 16 chars, url-safe, and not changeme', () => {
    const p = generateRconPassword();
    expect(p.length).toBeGreaterThanOrEqual(16);
    expect(p).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(p).not.toBe('changeme');
  });

  it('differs between calls', () => {
    expect(generateRconPassword()).not.toBe(generateRconPassword());
  });
});

describe('randomizeRconPassword', () => {
  it('replaces the changeme default', () => {
    const out = randomizeRconPassword('A=1\nRCON_PASSWORD=changeme\nRCON_PORT=25575\n');
    expect(out).not.toContain('changeme');
    expect(out).toMatch(/^RCON_PASSWORD=[A-Za-z0-9_-]{16,}$/m);
    expect(out).toContain('RCON_PORT=25575');
  });

  it('leaves a customized value untouched', () => {
    const src = 'RCON_PASSWORD=my-own-secret\n';
    expect(randomizeRconPassword(src)).toBe(src);
  });
});
