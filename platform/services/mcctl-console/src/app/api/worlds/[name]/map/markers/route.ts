import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { requireAuth, AuthError } from '@/lib/auth-utils';
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
 * POST /api/worlds/:name/map/markers
 * Proxy to mcctl-api: write structure markers into the rendered map (#530)
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth(await headers());
    const { name } = await params;
    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.writeMapMarkers(name);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized', message: error.message }, { status: error.statusCode });
    }
    if (error instanceof McctlApiError) {
      return NextResponse.json({ error: error.error, message: error.message }, { status: error.statusCode });
    }
    console.error('Failed to write map markers:', error);
    return NextResponse.json({ error: 'InternalServerError', message: 'Failed to write map markers' }, { status: 500 });
  }
}
