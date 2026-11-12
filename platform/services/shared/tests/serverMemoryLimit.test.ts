/**
 * serverMemoryLimitMb (#662): the container memory limit of a server, its
 * JVM heap plus room for everything else the JVM uses. Too low a limit gets
 * the server OOM-killed mid-save, so the rule is generous and gives no
 * limit when the heap is unknown.
 */
import { describe, it, expect } from 'vitest';
import { serverMemoryLimitMb } from '../src/domain/server-spec/serverMemoryLimit.js';

const limit = (memory: string | undefined, env: Record<string, string> = {}) => serverMemoryLimitMb({ memory, env });

describe('serverMemoryLimitMb', () => {
  it('adds max(2G, half the heap) to MEMORY', () => {
    expect(limit('512M')).toBe(512 + 2048);
    expect(limit('2G')).toBe(4096);
    expect(limit('4G')).toBe(6144);
    expect(limit('6G')).toBe(9216);
    expect(limit('8G')).toBe(12288);
  });

  it('reads the units itzg accepts, any case', () => {
    expect(limit('4096m')).toBe(6144);
    expect(limit('4g')).toBe(6144);
    expect(limit('4194304k')).toBe(6144);
    expect(limit(' 1.5G ')).toBe(1536 + 2048);
  });

  it('uses MAX_MEMORY, which sets the heap over MEMORY', () => {
    expect(limit('2G', { MAX_MEMORY: '8G', INIT_MEMORY: '2G' })).toBe(12288);
    expect(limit('2G', { MAX_MEMORY: '' })).toBe(4096);
  });

  it('gives no limit when the heap is unknown', () => {
    expect(limit(undefined)).toBeUndefined();
    expect(limit('')).toBeUndefined();
    expect(limit('75%')).toBeUndefined();
    expect(limit('4096')).toBeUndefined();
    expect(limit('lots')).toBeUndefined();
    expect(limit('2G', { MAX_MEMORY: '50%' })).toBeUndefined();
  });

  it('gives no limit when JVM options set the heap themselves', () => {
    expect(limit('2G', { JVM_OPTS: '-Dfoo=bar -Xmx8G' })).toBeUndefined();
    expect(limit('2G', { JVM_XX_OPTS: '-XX:MaxRAMPercentage=75' })).toBeUndefined();
    expect(limit('2G', { JAVA_TOOL_OPTIONS: '-XX:MaxRAM=8g' })).toBeUndefined();
    expect(limit('2G', { JVM_OPTS: '-Dfoo=bar' })).toBe(4096);
  });
});
