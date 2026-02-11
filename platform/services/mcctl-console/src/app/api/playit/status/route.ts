import { NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { getServerSession } from '@/lib/auth';
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
 * GET /api/playit/status
 * Proxy to mcctl-api: Get playit agent status
 */
export async function GET() {
  try {
    const session = await getServerSession(await headers());

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.getPlayitStatus();

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof McctlApiError) {
      return NextResponse.json(
        { error: error.error, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to fetch playit status:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch playit status' },
      { status: 500 }
    );
  }
}
