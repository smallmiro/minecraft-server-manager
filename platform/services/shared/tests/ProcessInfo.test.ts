import { describe, it, expect, vi, afterEach } from 'vitest';
import { ProcessInfo } from '../src/domain/value-objects/ProcessInfo.js';

describe('ProcessInfo.fromPm2', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('converts pm_uptime (start timestamp) to elapsed duration', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
    const startedAt = Date.now() - 130_000;

    const info = ProcessInfo.fromPm2({
      pm_id: 0,
      name: 'mcctl-api',
      pm2_env: { status: 'online', pm_uptime: startedAt },
    });

    expect(info.uptime).toBe(130_000);
    expect(info.uptimeFormatted).toBe('2m 10s');
  });

  it('leaves uptime undefined when pm_uptime is missing', () => {
    const info = ProcessInfo.fromPm2({ pm_id: 0, name: 'mcctl-api', pm2_env: {} });

    expect(info.uptime).toBeUndefined();
    expect(info.uptimeFormatted).toBe('N/A');
  });
});
