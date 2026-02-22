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
 * GET /api/servers/[name]/config-snapshots
 * Proxy to mcctl-api: List config snapshots for a server
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const session = await requireAuth(await headers());
    const { name } = await params;

    const limit = Number(request.nextUrl.searchParams.get('limit') || '20');
    const offset = Number(request.nextUrl.searchParams.get('offset') || '0');

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.listConfigSnapshots(name, limit, offset);

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

    console.error('Failed to fetch config snapshots:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch config snapshots' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/servers/[name]/config-snapshots
 * Proxy to mcctl-api: Create a config snapshot for a server
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const session = await requireAdmin(await headers());
    const { name } = await params;

    const body = await request.json().catch(() => ({}));
    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.createConfigSnapshot(name, body.description);

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

    console.error('Failed to create config snapshot:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to create config snapshot' },
      { status: 500 }
    );
  }
}
