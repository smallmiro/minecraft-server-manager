import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { requireAuth, requireAdmin, AuthError } from '@/lib/auth-utils';
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
 * GET /api/worlds/:name
 * Proxy to mcctl-api: Get world details
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth(await headers());

    const { name } = await params;
    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.getWorld(name);

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: 'Unauthorized', message: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof McctlApiError) {
      return NextResponse.json(
        { error: error.error, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to fetch world:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch world details' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/worlds/:name
 * Proxy to mcctl-api: Delete a world
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAdmin(await headers());

    const { name } = await params;
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.deleteWorld(name, force);

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

    console.error('Failed to delete world:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to delete world' },
      { status: 500 }
    );
  }
}
