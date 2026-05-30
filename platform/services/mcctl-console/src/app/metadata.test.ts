import { describe, it, expect } from 'vitest';
import { metadata, viewport } from './metadata';

describe('root layout PWA metadata', () => {
  it('marks the app as iOS web-app-capable so home-screen launch is full-screen', () => {
    const appleWebApp = metadata.appleWebApp as { capable?: boolean; title?: string };
    expect(appleWebApp).toBeTruthy();
    expect(appleWebApp.capable).toBe(true);
    expect(appleWebApp.title).toBeTruthy();
  });

  it('exposes a dark theme color and edge-to-edge viewport for standalone display', () => {
    expect(viewport.themeColor).toBe('#16181c');
    expect(viewport.viewportFit).toBe('cover');
  });
});
