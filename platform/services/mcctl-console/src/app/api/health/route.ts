import { NextResponse } from 'next/server';

/**
 * Health check endpoint for process monitoring.
 * Used by PM2, Docker HEALTHCHECK, and Kubernetes probes.
 *
 * @returns JSON response with health status and diagnostics
 *
 * @example
 * // PM2 health check
 * pm2 start ecosystem.config.js --health-check-http http://localhost:3000/api/health
 *
 * // curl check
 * curl -s http://localhost:3000/api/health | jq
 */
export async function GET() {
  const uptime = process.uptime();

  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'mcctl-console',
      version: process.env.npm_package_version || '0.1.0',
      uptime: {
        seconds: Math.floor(uptime),
        formatted: formatUptime(uptime),
      },
      environment: process.env.NODE_ENV || 'development',
      node: process.version,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}
