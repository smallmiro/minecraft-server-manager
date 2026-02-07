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
 * POST /api/backup/restore
 * Proxy to mcctl-api: Restore backup from commit hash
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin(await headers());

    const body = await request.json();
    const { commitHash } = body;

    if (!commitHash) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'commitHash is required' },
        { status: 400 }
      );
    }

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.restoreBackup(commitHash);

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

    console.error('Failed to restore backup:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to restore backup' },
      { status: 500 }
    );
  }
}
