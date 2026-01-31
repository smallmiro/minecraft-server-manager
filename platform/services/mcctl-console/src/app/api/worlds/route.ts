import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

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
    // Verify session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.getWorlds();

    return NextResponse.json(data);
  } catch (error) {
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
    // Verify session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.createWorld(body);

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
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
