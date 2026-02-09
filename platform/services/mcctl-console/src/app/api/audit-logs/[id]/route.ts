import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/audit-logs/[id]
 * Proxy to mcctl-api: Get single audit log detail with related logs
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(await headers());

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;
    const apiUrl = process.env.MCCTL_API_URL || 'http://localhost:5001';
    const apiKey = process.env.MCCTL_API_KEY || '';

    const response = await fetch(
      `${apiUrl}/api/audit-logs/${encodeURIComponent(id)}`,
      {
        headers: {
          'X-API-Key': apiKey,
          'X-User': session.user.name || session.user.email,
          'X-Role': session.user.role || 'user',
        },
      }
    );

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({
        error: 'UnknownError',
        message: response.statusText,
      }));
      return NextResponse.json(errorBody, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch audit log detail:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch audit log detail' },
      { status: 500 }
    );
  }
}
