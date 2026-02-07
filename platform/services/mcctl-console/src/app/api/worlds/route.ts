import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { requireAuth, AuthError } from '@/lib/auth-utils';
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
 * GET /api/worlds
 * Proxy to mcctl-api: List all worlds
 */
export async function GET() {
  try {
    const session = await requireAuth(await headers());

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.getWorlds();

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

    console.error('Failed to fetch worlds:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch worlds' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/worlds
 * Proxy to mcctl-api: Create a new world
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(await headers());

    const body = await request.json();
    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.createWorld(body);

    return NextResponse.json(data, { status: 201 });
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

    console.error('Failed to create world:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to create world' },
      { status: 500 }
    );
  }
}
