/**
 * Server Mods API Route
 * GET /api/servers/:name/mods - List installed mods
 * POST /api/servers/:name/mods - Add mods
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
 * GET /api/servers/:name/mods
 * Fetch installed mods for a server
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { name } = await params;
    const session = await requireServerPermission(await headers(), name, 'view');

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.getServerMods(name);

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

    console.error('Failed to fetch server mods:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch server mods' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/servers/:name/mods
 * Add mods to a server
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { name } = await params;
    const session = await requireServerPermission(await headers(), name, 'manage');

    const body = await request.json();

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.addServerMods(name, body.slugs, body.source);

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

    console.error('Failed to add mods:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to add mods' },
      { status: 500 }
    );
  }
}
