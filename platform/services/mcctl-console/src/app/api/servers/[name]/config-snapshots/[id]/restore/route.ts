import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { requireAuth, AuthError } from '@/lib/auth-utils';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

function getUserContext(session: {
  user: { name?: string | null; email: string; role?: string | null };
}): UserContext {
  return {
    username: session.user.name || session.user.email,
    role: session.user.role || 'user',
  };
}

/**
 * POST /api/servers/[name]/config-snapshots/[id]/restore
 * BFF proxy: Restore server configuration from a config snapshot
 * Proxies to mcctl-api: POST /api/servers/:name/config-snapshots/:id/restore
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { name: string; id: string } }
) {
  try {
    const session = await requireAuth(await headers());
    const { name, id } = params;

    if (!name || !id) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Server name and snapshot ID are required' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      createSnapshotBeforeRestore = true,
      force = false,
    } = body;

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.restoreConfigSnapshot(name, id, {
      createSnapshotBeforeRestore,
      force,
    });

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

    console.error('Failed to restore config snapshot:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to restore config snapshot' },
      { status: 500 }
    );
  }
}
