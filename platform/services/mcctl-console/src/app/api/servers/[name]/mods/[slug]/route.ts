/**
 * Server Mod Removal API Route
 * DELETE /api/servers/:name/mods/:slug - Remove a mod
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { requireServerPermission, AuthError } from '@/lib/auth-utils';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ name: string; slug: string }>;
}

function getUserContext(session: { user: { name?: string | null; email: string; role?: string | null } }): UserContext {
  return {
    username: session.user.name || session.user.email,
    role: session.user.role || 'user',
  };
}

/**
 * DELETE /api/servers/:name/mods/:slug
 * Remove a mod from server
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { name, slug } = await params;
    const session = await requireServerPermission(await headers(), name, 'manage');

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.removeServerMod(name, slug);

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

    console.error('Failed to remove mod:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to remove mod' },
      { status: 500 }
    );
  }
}
