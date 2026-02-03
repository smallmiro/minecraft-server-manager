import { describe, it, expect } from 'vitest';
import { darkTheme } from './muiTheme';

describe('darkTheme', () => {
  it('should have dark mode palette', () => {
    expect(darkTheme.palette.mode).toBe('dark');
  });

  it('should have correct primary color', () => {
    expect(darkTheme.palette.primary.main).toBe('#1bd96a');
    expect(darkTheme.palette.primary.light).toBe('#4de38a');
    expect(darkTheme.palette.primary.dark).toBe('#15a852');
  });

  it('should have correct secondary color', () => {
    expect(darkTheme.palette.secondary.main).toBe('#7c3aed');
    expect(darkTheme.palette.secondary.light).toBe('#9f67f0');
    expect(darkTheme.palette.secondary.dark).toBe('#5b21b6');
  });

  it('should have correct background colors', () => {
    expect(darkTheme.palette.background.default).toBe('#16181c');
    expect(darkTheme.palette.background.paper).toBe('#1a1d22');
  });

  it('should have correct status colors', () => {
    expect(darkTheme.palette.success.main).toBe('#22c55e');
    expect(darkTheme.palette.error.main).toBe('#ef4444');
    expect(darkTheme.palette.warning.main).toBe('#f59e0b');
  });

  it('should have correct text colors', () => {
    expect(darkTheme.palette.text.primary).toBe('#ffffff');
    expect(darkTheme.palette.text.secondary).toBe('#9a9a9a');
  });
});
