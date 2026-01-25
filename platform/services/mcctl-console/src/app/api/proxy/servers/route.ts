import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const API_URL = process.env['MCCTL_API_URL'] || 'http://localhost:3001';

/**
 * BFF Proxy for /api/proxy/servers
 * GET - List all servers
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const response = await fetch(`${API_URL}/v1/servers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env['MCCTL_API_KEY'] || '',
      },
      // No cache for real-time server status
      cache: 'no-store',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { code: 'API_ERROR', message: error.message || 'Failed to fetch servers' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { code: 'PROXY_ERROR', message: 'Failed to connect to backend API' },
      { status: 502 }
    );
  }
}
