/**
 * Player Detail API Route (#528)
 * GET /api/servers/:name/players/:uuid
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { requireServerPermission, AuthError } from '@/lib/auth-utils';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ name: string; uuid: string }>;
}

function getUserContext(session: { user: { name?: string | null; email: string; role?: string | null } }): UserContext {
  return {
    username: session.user.name || session.user.email,
    role: session.user.role || 'user',
  };
}

// Recognized `include` values. Unknown values (e.g. a future `nbt`/`sessions`
// from later phases) are dropped rather than forwarded.
const SUPPORTED_INCLUDE = new Set(['stats']);

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { name, uuid } = await params;
    const session = await requireServerPermission(await headers(), name, 'view');

    const { searchParams } = new URL(request.url);
    const includeParam = searchParams.get('include');
    const include = includeParam
      ? includeParam.split(',').map((s) => s.trim()).filter((s) => SUPPORTED_INCLUDE.has(s))
      : [];

    const client = createMcctlApiClient(getUserContext(session));
    const data = include.length > 0
      ? await client.getPlayer(name, uuid, include)
      : await client.getPlayer(name, uuid);

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Forbidden', message: error.message }, { status: error.statusCode });
    }
    if (error instanceof McctlApiError) {
      return NextResponse.json({ error: error.error, message: error.message }, { status: error.statusCode });
    }
    console.error('Failed to fetch player detail:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch player detail' },
      { status: 500 }
    );
  }
}
