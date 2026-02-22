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
 * GET /api/backup/schedules/[id]
 * Proxy to mcctl-api: Get a specific backup schedule
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(await headers());
    const { id } = await params;

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.getBackupSchedule(id);

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

    console.error('Failed to fetch backup schedule:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch backup schedule' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/backup/schedules/[id]
 * Proxy to mcctl-api: Update a backup schedule
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
    const data = await client.updateBackupSchedule(id, body);

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

    console.error('Failed to update backup schedule:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to update backup schedule' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/backup/schedules/[id]
 * Proxy to mcctl-api: Delete a backup schedule
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin(await headers());
    const { id } = await params;

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.deleteBackupSchedule(id);

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

    console.error('Failed to delete backup schedule:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to delete backup schedule' },
      { status: 500 }
    );
  }
}
