import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const API_URL = process.env['MCCTL_API_URL'] || 'http://localhost:3001';

interface RouteParams {
  params: Promise<{ name: string }>;
}

/**
 * BFF Proxy for /api/proxy/servers/[name]/logs
 * GET - Get server logs
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { name } = await params;
    const searchParams = request.nextUrl.searchParams;
    const lines = searchParams.get('lines') || '50';

    const response = await fetch(
      `${API_URL}/v1/servers/${encodeURIComponent(name)}/logs?lines=${lines}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env['MCCTL_API_KEY'] || '',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { code: 'API_ERROR', message: error.message || 'Failed to fetch logs' },
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
