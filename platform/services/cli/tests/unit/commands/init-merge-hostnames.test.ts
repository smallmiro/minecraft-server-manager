import { describe, it, expect } from 'vitest';
import { mergeHostnames } from '../../../src/commands/init.js';

describe('mergeHostnames', () => {
  it('replaces old nip.io IPs, keeps custom and playit hostnames', () => {
    const r = mergeHostnames('factory', '10.0.0.2', 'factory.local,factory.1.2.3.4.nip.io,mc.example.com,x.gl.joinmc.link');
    expect(r).toBe('factory.local,factory.10.0.0.2.nip.io,mc.example.com,x.gl.joinmc.link');
  });
  it('does not duplicate system hostnames', () => {
    expect(mergeHostnames('a', '10.0.0.2', 'a.local,a.10.0.0.2.nip.io')).toBe('a.local,a.10.0.0.2.nip.io');
  });
  it('does not treat other servers hostnames as system', () => {
    expect(mergeHostnames('a', '', 'ab.local')).toBe('a.local,ab.local');
  });
});
