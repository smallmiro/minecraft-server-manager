import type { Metadata, Viewport } from 'next';

/**
 * Root metadata + viewport, kept in their own module so they can be unit-tested
 * without importing the full layout (which pulls in the DB/provider tree).
 *
 * `appleWebApp.capable` is the key to #478: it emits
 * `<meta name="apple-mobile-web-app-capable" content="yes">`, so a home-screen
 * shortcut launches full-screen instead of inside the iOS Safari overlay chrome.
 */
export const metadata: Metadata = {
  title: 'Minecraft Server Manager',
  description: 'Web-based management console for Minecraft server infrastructure',
  applicationName: 'MC Console',
  appleWebApp: {
    capable: true,
    title: 'Minecraft Console',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#16181c',
  // Extend under the notch / home indicator for a native standalone feel.
  viewportFit: 'cover',
};
