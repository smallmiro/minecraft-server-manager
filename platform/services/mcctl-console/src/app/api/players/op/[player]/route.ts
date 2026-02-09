/**
 * OP Level Management API Route
 * PATCH /api/players/op/[player]?server=<name>
 * Update operator level
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
 * PATCH /api/players/op/[player]?server=<name>
 * Update operator level
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ player: string }> }
) {
  try {
    const { player } = await context.params;
    const { searchParams } = new URL(request.url);
    const server = searchParams.get('server');

    if (!server) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'Server name is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { level } = body;

    if (!level || level < 1 || level > 4) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'Level must be between 1 and 4' },
        { status: 400 }
      );
    }

    const session = await requireServerPermission(await headers(), server, 'admin');
    const client = createMcctlApiClient(getUserContext(session));

    const result = await client.updateOpLevel(server, player, level);

    return NextResponse.json({
      success: result.success,
      operator: result.operator,
      message: result.message,
      source: result.source,
    });
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

    console.error('Failed to update operator level:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to update operator level' },
      { status: 500 }
    );
  }
}
