/**
 * Server Directory Create API Route
 * POST /api/servers/:name/files/mkdir?path=...
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

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { name } = await params;
    const session = await requireServerPermission(await headers(), name, 'manage');

    const path = request.nextUrl.searchParams.get('path');
    if (!path) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'path query parameter is required' },
        { status: 400 }
      );
    }

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.createDirectory(name, path);

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

    console.error('Failed to create directory:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to create directory' },
      { status: 500 }
    );
  }
}
