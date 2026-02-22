import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { requireAuth, requireAdmin, AuthError } from '@/lib/auth-utils';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * Extract user context from session for API forwarding
 */
function getUserContext(session: { user: { name?: string | null; email: string; role?: string | null } }): UserContext {
  return {
    username: session.user.name || session.user.email,
    role: session.user.role || 'user',
  };
}

/**
 * GET /api/config-snapshot-schedules
 * Proxy to mcctl-api: List all config snapshot schedules
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(await headers());

    const serverName = request.nextUrl.searchParams.get('serverName') || undefined;
    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.getConfigSnapshotSchedules(serverName);

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: 'Unauthorized', message: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof McctlApiError) {
      return NextResponse.json(
        { error: error.error, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to fetch config snapshot schedules:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch config snapshot schedules' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/config-snapshot-schedules
 * Proxy to mcctl-api: Create a new config snapshot schedule
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin(await headers());

    const body = await request.json();
    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.createConfigSnapshotSchedule(body);

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: 'Forbidden', message: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof McctlApiError) {
      return NextResponse.json(
        { error: error.error, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to create config snapshot schedule:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to create config snapshot schedule' },
      { status: 500 }
    );
  }
}
