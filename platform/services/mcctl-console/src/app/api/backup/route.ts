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
 * GET /api/backup
 * Proxy to mcctl-api: Get backup status
 */
export async function GET() {
  try {
    const session = await requireAuth(await headers());

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.getBackupStatus();

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

    console.error('Failed to fetch backup status:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch backup status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/backup
 * Proxy to mcctl-api: Push backup
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin(await headers());

    const body = await request.json().catch(() => ({}));
    const message = body.message;

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.pushBackup(message);

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

    console.error('Failed to push backup:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to push backup' },
      { status: 500 }
    );
  }
}
