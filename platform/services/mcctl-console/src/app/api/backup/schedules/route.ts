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
 * GET /api/backup/schedules
 * Proxy to mcctl-api: List all backup schedules
 */
export async function GET() {
  try {
    const session = await requireAuth(await headers());

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.getBackupSchedules();

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

    console.error('Failed to fetch backup schedules:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch backup schedules' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/backup/schedules
 * Proxy to mcctl-api: Create a new backup schedule
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin(await headers());

    const body = await request.json();
    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.createBackupSchedule(body);

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

    console.error('Failed to create backup schedule:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to create backup schedule' },
      { status: 500 }
    );
  }
}
