/**
 * Server File Write API Route
 * PUT /api/servers/:name/files/write?path=...
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

export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json();

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.writeFile(name, path, body.content);

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

    console.error('Failed to write file:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to write file' },
      { status: 500 }
    );
  }
}
