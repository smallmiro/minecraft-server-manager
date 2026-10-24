import type { BentoAccent } from '@/components/bento';

/**
 * Format a duration in seconds as a short uptime string ("4d 18h 42m").
 */
export function formatUptime(seconds?: number): string {
  if (!seconds || seconds < 0) return '0s';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}

export function formatCpuPercent(percent: number): string {
  return `${percent.toFixed(1)}%`;
}

/**
 * Parse a docker-style memory setting ("4G", "512M", "2048") to MB.
 * Returns undefined when the allocation is unknown.
 */
export function parseAllocatedMemoryToMB(memory?: string): number | undefined {
  if (!memory) return undefined;
  const match = memory.trim().match(/^(\d+)\s*(M|G)?$/i);
  if (!match) return undefined;
  const value = parseInt(match[1], 10);
  return (match[2] || 'M').toUpperCase() === 'G' ? value * 1024 : value;
}

/**
 * Format container memory usage as "used / allocated GB".
 */
export function formatMemoryUsage(usedBytes: number, allocatedMB?: number): string {
  const usedGB = (usedBytes / 1024 ** 3).toFixed(2);
  if (allocatedMB === undefined) return `${usedGB} GB`;
  return `${usedGB} / ${(allocatedMB / 1024).toFixed(2)} GB`;
}

export type UsageLevel = 'normal' | 'warning' | 'critical';

const WARNING_THRESHOLD = 70;
const CRITICAL_THRESHOLD = 90;

export function getUsageLevel(percent: number): UsageLevel {
  if (percent >= CRITICAL_THRESHOLD) return 'critical';
  if (percent >= WARNING_THRESHOLD) return 'warning';
  return 'normal';
}

export const USAGE_LEVEL_ACCENT: Record<UsageLevel, BentoAccent> = {
  normal: 'success',
  warning: 'warning',
  critical: 'error',
};

export const USAGE_LEVEL_LABEL: Record<UsageLevel, string> = {
  normal: 'Normal',
  warning: 'High',
  critical: 'Critical',
};
