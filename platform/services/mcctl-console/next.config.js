/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@minecraft-docker/shared'],
};

module.exports = nextConfig;
