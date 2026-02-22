import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
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
 * PATCH /api/backup/schedules/[id]/toggle
 * Proxy to mcctl-api: Toggle backup schedule enabled/disabled
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin(await headers());
    const { id } = await params;

    const body = await request.json();
    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.toggleBackupSchedule(id, body.enabled);

    return NextResponse.json(data);
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

    console.error('Failed to toggle backup schedule:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to toggle backup schedule' },
      { status: 500 }
    );
  }
}
