import { describe, it, expect } from 'vitest';
import manifest from './manifest';

describe('PWA web app manifest', () => {
  const m = manifest();

  it('declares a standalone, root-scoped installable app', () => {
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('/');
    expect(m.scope).toBe('/');
  });

  it('provides a name and a short_name that fits a home-screen label', () => {
    expect(m.name).toMatch(/minecraft/i);
    expect(m.short_name).toBeTruthy();
    expect((m.short_name as string).length).toBeLessThanOrEqual(12);
  });

  it('uses the dark theme background colors', () => {
    expect(m.background_color).toBe('#16181c');
    expect(m.theme_color).toBe('#16181c');
  });

  it('declares a scalable icon and a maskable icon', () => {
    const icons = m.icons ?? [];
    expect(icons.length).toBeGreaterThan(0);
    expect(icons.some((i) => i.type === 'image/svg+xml' && i.sizes === 'any')).toBe(true);
    expect(icons.some((i) => (i.purpose ?? '').includes('maskable'))).toBe(true);
  });
});
