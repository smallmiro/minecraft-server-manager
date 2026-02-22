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
 * GET /api/config-snapshots/[id1]/diff/[id2]
 * BFF proxy: Get diff between two config snapshots
 * Proxies to mcctl-api: GET /api/config-snapshots/:id1/diff/:id2
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id1: string; id2: string } }
) {
  try {
    const session = await requireAuth(await headers());
    const { id1, id2 } = params;

    if (!id1 || !id2) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Both snapshot IDs are required' },
        { status: 400 }
      );
    }

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.getConfigSnapshotDiff(id1, id2);

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

    console.error('Failed to get config snapshot diff:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to get config snapshot diff' },
      { status: 500 }
    );
  }
}
