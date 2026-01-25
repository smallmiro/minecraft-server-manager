import { NextResponse } from 'next/server';

/**
 * Health check endpoint for container orchestration.
 * Used by Docker HEALTHCHECK and Kubernetes probes.
 *
 * @returns JSON response with health status
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'mcctl-console',
    },
    { status: 200 }
  );
}
