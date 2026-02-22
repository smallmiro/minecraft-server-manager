/**
 * Server Files API Route
 * GET /api/servers/:name/files - List directory contents
 * DELETE /api/servers/:name/files - Delete file/directory
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
 * GET /api/servers/:name/files?path=/
 * List directory contents
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { name } = await params;
    const session = await requireServerPermission(await headers(), name, 'view');

    const path = request.nextUrl.searchParams.get('path') || '/';

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.listFiles(name, path);

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

    console.error('Failed to list files:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to list files' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/servers/:name/files?path=...
 * Delete file or directory
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
    const data = await client.deleteFile(name, path);

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

    console.error('Failed to delete file:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to delete file' },
      { status: 500 }
    );
  }
}
