/**
 * Server Configuration API Route
 * GET/PATCH /api/servers/:name/config
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { requireServerPermission, AuthError } from '@/lib/auth-utils';
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
    const { name } = await params;
    const session = await requireServerPermission(await headers(), name, 'view');

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.getServerConfig(name);

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
    const { name } = await params;
    const session = await requireServerPermission(await headers(), name, 'manage');

    const body = await request.json();

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.updateServerConfig(name, body);

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

    console.error('Failed to update server config:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to update server config' },
      { status: 500 }
    );
  }
}
