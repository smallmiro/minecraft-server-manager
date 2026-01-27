/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for native PM2 deployment
  // Creates a self-contained build in .next/standalone
  output: 'standalone',

  // Enable Server Actions
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Strict mode for better development experience
  reactStrictMode: true,

  // Disable x-powered-by header for security
  poweredByHeader: false,

  // Environment variables exposed to the browser (NEXT_PUBLIC_*)
  // Server-side variables are read from process.env directly
  env: {
    // Build-time version for debugging
    BUILD_TIME: new Date().toISOString(),
  },

  // Optimize for production
  compiler: {
    // Remove console.log in production
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? { exclude: ['error', 'warn'] }
        : false,
  },

  // ESLint configuration
  eslint: {
    // Don't fail build on ESLint errors (run separately)
    ignoreDuringBuilds: false,
  },

  // TypeScript configuration
  typescript: {
    // Don't fail build on TS errors (run separately)
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
