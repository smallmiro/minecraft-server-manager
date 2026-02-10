/**
 * Server Hostnames API Route
 * GET/PUT /api/servers/:name/hostnames
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { requireServerPermission, AuthError } from '@/lib/auth-utils';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ name: string }>;
}

function getUserContext(session: { user: { name?: string | null; email: string; role?: string | null } }): UserContext {
  return {
    username: session.user.name || session.user.email,
    role: session.user.role || 'user',
  };
}

/**
 * GET /api/servers/:name/hostnames
 * Fetch server hostnames
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { name } = await params;
    const session = await requireServerPermission(await headers(), name, 'view');

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.getHostnames(name);

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

    console.error('Failed to fetch server hostnames:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch server hostnames' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/servers/:name/hostnames
 * Update custom hostnames
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { name } = await params;
    const session = await requireServerPermission(await headers(), name, 'manage');

    const body = await request.json();

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.updateHostnames(name, body.customHostnames);

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

    console.error('Failed to update server hostnames:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to update server hostnames' },
      { status: 500 }
    );
  }
}
