import { describe, it, expect } from 'vitest';
import { getAnalyticsSettings } from './analytics';
import { normalizePath, ANALYTICS_BASE } from './analytics-path';

describe('normalizePath', () => {
  it.each([
    ['/servers/survival', '/servers/:name'],
    ['/servers/survival/console', '/servers/:name/console'],
    ['/servers/survival/a/b', '/servers/:name/a/b'],
    ['/servers/survival/?x=1#h', '/servers/:name'],
    ['/servers', '/servers'],
    ['/servers/', '/servers'],
    ['/dashboard?tab=1', '/dashboard'],
    ['/', '/'],
    ['', '/'],
    ['/worlds/foo', '/worlds/foo'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizePath(input)).toBe(expected);
  });
  it('base is not a real host', () => {
    expect(ANALYTICS_BASE).toBe('http://mcctl-console.invalid');
  });
});

describe('getAnalyticsSettings', () => {
  const mk = (config: unknown, id: string | null = 'id-1') => ({
    load: () => config as never,
    getOrCreateInstallId: () => id,
  });
  const prod = { NODE_ENV: 'production' } as NodeJS.ProcessEnv;

  it('returns settings when enabled', () => {
    expect(getAnalyticsSettings(prod, mk({ telemetry: true }))).toEqual({
      installId: 'id-1',
      version: expect.any(String),
    });
  });
  it('null when not production', () => {
    expect(getAnalyticsSettings({ NODE_ENV: 'development' } as never, mk({}))).toBeNull();
  });
  it('null when telemetry false', () => {
    expect(getAnalyticsSettings(prod, mk({ telemetry: false }))).toBeNull();
  });
  it('null when DO_NOT_TRACK', () => {
    expect(getAnalyticsSettings({ ...prod, DO_NOT_TRACK: '1' } as never, mk({}))).toBeNull();
  });
  it('null when config missing', () => {
    expect(getAnalyticsSettings(prod, mk(null))).toBeNull();
  });
  it('null when installId unavailable', () => {
    expect(getAnalyticsSettings(prod, mk({}, null))).toBeNull();
  });
});
