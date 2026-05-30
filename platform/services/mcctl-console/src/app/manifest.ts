import type { MetadataRoute } from 'next';

/**
 * Web App Manifest — makes the console an installable, standalone PWA so a
 * home-screen shortcut launches full-screen instead of inside the iOS Safari
 * overlay chrome (the close button + URL bar). See #478.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Minecraft Server Manager',
    short_name: 'MC Console',
    description: 'Web-based management console for Minecraft server infrastructure',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#16181c',
    theme_color: '#16181c',
    icons: [
      // Scalable icon — covers all sizes for browsers that accept SVG.
      { src: '/icons/icon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' },
      // Padded variant for Android adaptive (maskable) icons.
      { src: '/icons/maskable.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'maskable' },
    ],
  };
}
