import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

/**
 * GET /api/audit-logs/stats
 * Proxy to mcctl-api: Get audit log statistics
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const apiUrl = process.env.MCCTL_API_URL || 'http://localhost:5001';
    const apiKey = process.env.MCCTL_API_KEY || '';

    const response = await fetch(`${apiUrl}/api/audit-logs/stats`, {
      headers: {
        'X-API-Key': apiKey,
        'X-User': session.user.name || session.user.email,
        'X-Role': session.user.role || 'user',
      },
    });

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
    console.error('Failed to fetch audit log stats:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch audit log statistics' },
      { status: 500 }
    );
  }
}
