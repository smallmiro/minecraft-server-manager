/**
 * Server Configuration API Route
 * GET/PATCH /api/servers/:name/config
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ name: string }>;
}

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
 * GET /api/servers/:name/config
 * Fetch server configuration
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
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

    const { name } = await params;

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.getServerConfig(name);

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof McctlApiError) {
      return NextResponse.json(
        { error: error.error, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to fetch server config:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch server config' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/servers/:name/config
 * Update server configuration
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const { name } = await params;
    const body = await request.json();

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.updateServerConfig(name, body);

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof McctlApiError) {
      return NextResponse.json(
        { error: error.error, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to update server config:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to update server config' },
      { status: 500 }
    );
  }
}
