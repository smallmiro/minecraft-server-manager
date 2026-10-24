import { describe, it, expect } from 'vitest';
import { formatAsleepMotd } from './motd';

describe('formatAsleepMotd', () => {
  it('converts literal \\n sequences to line breaks', () => {
    expect(formatAsleepMotd('line one\\nline two')).toBe('line one\nline two');
  });

  it('strips section-sign formatting codes', () => {
    expect(formatAsleepMotd('§aServer is §lsleeping§r')).toBe('Server is sleeping');
  });

  it('handles codes and newlines together', () => {
    expect(formatAsleepMotd('§e§lHello\\n§7Connect to wake')).toBe('Hello\nConnect to wake');
  });

  it('keeps real newlines and plain text untouched', () => {
    expect(formatAsleepMotd('a\nb')).toBe('a\nb');
    expect(formatAsleepMotd('plain')).toBe('plain');
  });

  it('does not strip text after a section sign that is not followed by a code char', () => {
    expect(formatAsleepMotd('cost §')).toBe('cost §');
  });

  it('returns an empty string for blank input', () => {
    expect(formatAsleepMotd('')).toBe('');
    expect(formatAsleepMotd('  \\n ')).toBe('');
  });
});
