import { NextResponse } from 'next/server';
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
 * POST /api/playit/start
 * Proxy to mcctl-api: Start playit-agent
 */
export async function POST() {
  try {
    const session = await requireAuth(await headers());

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.startPlayit();

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

    console.error('Failed to start playit agent:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to start playit agent' },
      { status: 500 }
    );
  }
}
