import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { getServerSession } from '@/lib/auth';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * Extract user context from session
 */
function getUserContext(session: { user: { name?: string | null; email: string; role?: string | null } }): UserContext {
  return {
    username: session.user.name || session.user.email,
    role: session.user.role || 'user',
  };
}

/**
 * GET /api/audit-logs
 * Proxy to mcctl-api: List audit logs with filtering/pagination
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(await headers());

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Forward query parameters
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();

    const apiUrl = process.env.MCCTL_API_URL || 'http://localhost:5001';
    const apiKey = process.env.MCCTL_API_KEY || '';
    const userContext = getUserContext(session);

    const response = await fetch(
      `${apiUrl}/api/audit-logs${queryString ? `?${queryString}` : ''}`,
      {
        headers: {
          'X-API-Key': apiKey,
          'X-User': userContext.username,
          'X-Role': userContext.role,
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
    console.error('Failed to fetch audit logs:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/audit-logs
 * Proxy to mcctl-api: Purge audit logs (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(await headers());

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check admin role
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const apiUrl = process.env.MCCTL_API_URL || 'http://localhost:5001';
    const apiKey = process.env.MCCTL_API_KEY || '';
    const userContext = getUserContext(session);

    const response = await fetch(`${apiUrl}/api/audit-logs`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        'X-User': userContext.username,
        'X-Role': userContext.role,
      },
      body: JSON.stringify(body),
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
    console.error('Failed to purge audit logs:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to purge audit logs' },
      { status: 500 }
    );
  }
}
