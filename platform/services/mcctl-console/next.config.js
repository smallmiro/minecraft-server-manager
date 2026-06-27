/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@minecraft-docker/shared'],
  async headers() {
    const sharedHeaders = [
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
    ];
    return [
      {
        // Everything EXCEPT the rendered map webroot is DENY-framed.
        source: '/((?!api/worlds/[^/]+/map/web).*)',
        headers: [{ key: 'X-Frame-Options', value: 'DENY' }, ...sharedHeaders],
      },
      {
        // The BlueMap webroot is embedded in a same-origin iframe by the
        // world map panel (#529), so it must allow SAMEORIGIN framing.
        source: '/api/worlds/:name/map/web/:path*',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }, ...sharedHeaders],
      },
    ];
  },
};

module.exports = nextConfig;
