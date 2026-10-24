import { describe, expect, it } from 'vitest';
import {
  formatCpuPercent,
  formatMemoryUsage,
  formatUptime,
  getUsageLevel,
  parseAllocatedMemoryToMB,
  USAGE_LEVEL_ACCENT,
  USAGE_LEVEL_LABEL,
} from './format';

describe('formatUptime', () => {
  it('returns 0s for missing or negative values', () => {
    expect(formatUptime(undefined)).toBe('0s');
    expect(formatUptime(-5)).toBe('0s');
  });

  it('formats seconds, minutes and hours', () => {
    expect(formatUptime(42)).toBe('42s');
    expect(formatUptime(125)).toBe('2m 5s');
    expect(formatUptime(3 * 3600 + 7 * 60)).toBe('3h 7m');
  });

  it('adds a day unit once uptime passes 24 hours', () => {
    expect(formatUptime(4 * 86400 + 18 * 3600 + 42 * 60 + 9)).toBe('4d 18h 42m');
    expect(formatUptime(86400)).toBe('1d 0h 0m');
  });
});

describe('formatCpuPercent', () => {
  it('uses one decimal place', () => {
    expect(formatCpuPercent(25)).toBe('25.0%');
    expect(formatCpuPercent(3.456)).toBe('3.5%');
  });
});

describe('parseAllocatedMemoryToMB', () => {
  it('parses docker-style memory settings', () => {
    expect(parseAllocatedMemoryToMB('4G')).toBe(4096);
    expect(parseAllocatedMemoryToMB('512M')).toBe(512);
    expect(parseAllocatedMemoryToMB('2048')).toBe(2048);
  });

  it('returns undefined when the allocation is unknown', () => {
    expect(parseAllocatedMemoryToMB(undefined)).toBeUndefined();
    expect(parseAllocatedMemoryToMB('lots')).toBeUndefined();
  });
});

describe('formatMemoryUsage', () => {
  it('shows used over allocated gigabytes', () => {
    expect(formatMemoryUsage(2560 * 1024 * 1024, 4096)).toBe('2.50 / 4.00 GB');
  });

  it('shows only used memory when the allocation is unknown', () => {
    expect(formatMemoryUsage(1024 * 1024 * 1024, undefined)).toBe('1.00 GB');
  });
});

describe('getUsageLevel', () => {
  it('maps a percentage to normal, warning and critical', () => {
    expect(getUsageLevel(0)).toBe('normal');
    expect(getUsageLevel(69.9)).toBe('normal');
    expect(getUsageLevel(70)).toBe('warning');
    expect(getUsageLevel(89.9)).toBe('warning');
    expect(getUsageLevel(90)).toBe('critical');
    expect(getUsageLevel(250)).toBe('critical');
  });

  it('maps each level to an accent and a status word', () => {
    expect(USAGE_LEVEL_ACCENT).toEqual({ normal: 'success', warning: 'warning', critical: 'error' });
    expect(USAGE_LEVEL_LABEL).toEqual({ normal: 'Normal', warning: 'High', critical: 'Critical' });
  });
});
