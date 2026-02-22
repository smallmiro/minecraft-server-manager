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
 * PUT /api/config-snapshot-schedules/[id]
 * Proxy to mcctl-api: Update a config snapshot schedule
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin(await headers());
    const { id } = await params;

    const body = await request.json();
    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.updateConfigSnapshotSchedule(id, body);

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

    console.error('Failed to update config snapshot schedule:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to update config snapshot schedule' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/config-snapshot-schedules/[id]
 * Proxy to mcctl-api: Delete a config snapshot schedule
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin(await headers());
    const { id } = await params;

    const client = createMcctlApiClient(getUserContext(session));
    await client.deleteConfigSnapshotSchedule(id);

    return NextResponse.json({ success: true, message: 'Schedule deleted' });
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

    console.error('Failed to delete config snapshot schedule:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to delete config snapshot schedule' },
      { status: 500 }
    );
  }
}
