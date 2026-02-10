/**
 * Whitelist Status API Route
 * GET/PUT /api/players/whitelist/status
 * Proxy to mcctl-api whitelist status endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { requireServerPermission, AuthError } from '@/lib/auth-utils';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

function getUserContext(session: { user: { name?: string | null; email: string; role?: string | null } }): UserContext {
  return {
    username: session.user.name || session.user.email,
    role: session.user.role || 'user',
  };
}

/**
 * GET /api/players/whitelist/status?server=<name>
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const server = searchParams.get('server');

    if (!server) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'Server name is required' },
        { status: 400 }
      );
    }

    const session = await requireServerPermission(await headers(), server, 'view');
    const client = createMcctlApiClient(getUserContext(session));

    const result = await client.getWhitelistStatus(server);

    return NextResponse.json(result);
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

    console.error('Failed to fetch whitelist status:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch whitelist status' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/players/whitelist/status
 * Body: { server: string, enabled: boolean }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { server, enabled } = body;

    if (!server || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'BadRequest', message: 'Server name and enabled (boolean) are required' },
        { status: 400 }
      );
    }

    const session = await requireServerPermission(await headers(), server, 'manage');
    const client = createMcctlApiClient(getUserContext(session));

    const result = await client.setWhitelistStatus(server, enabled);

    return NextResponse.json(result);
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

    console.error('Failed to update whitelist status:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to update whitelist status' },
      { status: 500 }
    );
  }
}
